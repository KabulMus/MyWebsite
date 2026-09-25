/**
 * 开明式标点 · 行尾压缩（第 3 层）
 * -------------------------------
 * 哪些句末号该占全角已经在构建期定好了（span.punct-full）。这里只处理一种情况：
 * 那个占全角的句末号正好落在「段中某一行的行尾」，它后面没有任何字要跟它拉开距离，
 * 占满一格会在版心右缘留出一个洞，所以运行时量出来再压回半宽。
 * 为什么非得运行时量：CSS 选择器看不见行盒，「这个字是不是本行最后一个」只有布局完才知道。
 * 为什么跳过段的最后一行：段末本来就等于行尾，构建期已经按行尾处理过了。
 * 没有 JS 时整套不生效，退化成构建期那层，不会比现在更糟。
 */
(function () {
	'use strict';

	/* 段中行尾只可能出现在「会折行的块」里，和构建期的块集合保持一致 */
	var BLOCK_SEL = 'p, li, figcaption, blockquote, td, th, dd, dt';
	var FULL_SEL = '.punct-full';
	var LINE_END = 'punct-line-end';
	var LINE_HEAD = 'punct-line-head';

	var lastWidth = -1;
	var queued = false;
	var widths = new WeakMap();

	/* 粘接界限：本应只有半格（0.5em），但「这个字要占多宽」量不准。
	   text-autospace 在中文西文交界处插的 1/8em 会被浏览器算进后面那个字的盒子里，
	   所以跨交界的字量出来永远偏胖：16px 字号下数字 1 的真实推进是 6.44px，
	   getBoundingClientRect() 量到的是 8.44px，正好差 2px（就是 1/8em）。
	   半格 8px 加上这个误差就到 10.4px，所以界限取 0.5em * 1.3 ≈ 0.65em（16px 字号即 10.4px）。
	   多粘一小块只是让断行更保守，漏粘才会把下一行的头一个字吸上来，两者代价差得远。 */
	var GLUE_LIMIT = 0.65;

	/* 抹掉上一轮的痕迹：拆掉包裹、去掉行尾标记，并把相邻文本节点合回去。
	   字体就绪和容器变宽都会让行尾换位置，所以必须能反复重跑，重跑前先 reset 才幂等。 */
	function reset() {
		var heads = document.querySelectorAll('.' + LINE_HEAD);
		for (var i = 0; i < heads.length; i++) {
			var el = heads[i];
			var parent = el.parentNode;
			if (!parent) continue;
			while (el.firstChild) parent.insertBefore(el.firstChild, el);
			parent.removeChild(el);
			parent.normalize();
		}
		var ends = document.querySelectorAll('.' + LINE_END);
		for (var j = 0; j < ends.length; j++) ends[j].classList.remove(LINE_END);
	}

	/* 把一块摊成字符表，再按 top 分行（同一行的 top 相差小于半个字号）。
	   零宽度的字符属于隐藏或折叠的内容，跳过不量。 */
	function layout(block) {
		var nodes = [];
		(function collect(node) {
			for (var child = node.firstChild; child; child = child.nextSibling) {
				if (child.nodeType === 3) {
					if (child.nodeValue) nodes.push(child);
				} else if (child.nodeType === 1) {
					collect(child);
				}
			}
		})(block);

		var chars = [];
		for (var i = 0; i < nodes.length; i++) {
			var node = nodes[i];
			var value = node.nodeValue;
			for (var k = 0; k < value.length; k++) {
				var range = document.createRange();
				range.setStart(node, k);
				range.setEnd(node, k + 1);
				var box = range.getBoundingClientRect();
				if (!box.width && !box.height) continue;
				chars.push({ node: node, index: k, char: value.charAt(k), width: box.width, top: box.top });
			}
		}
		if (!chars.length) return null;

		var size = parseFloat(getComputedStyle(block).fontSize) || 16;
		var lines = [];
		for (var m = 0; m < chars.length; m++) {
			var ch = chars[m];
			var line = lines[lines.length - 1];
			if (line && Math.abs(ch.top - line.top) < size * 0.5) line.chars.push(ch);
			else lines.push({ top: ch.top, chars: [ch] });
		}
		return { size: size, lines: lines };
	}

	/* 把下一行开头那几项粘成一块，合计宽度超过界限就塞不进压掉的那半格，断行点不动。
	   数字和半角字母这类窄字符会被吸上来，所以要粘；整格汉字本来就超过界限，粘不粘一样。
	   跨了加粗和链接这类元素边界就粘不住，返回 false，这一处宁可不压。 */
	function glueHead(info, lineIndex) {
		var next = info.lines[lineIndex + 1];
		if (!next || !next.chars.length) return true;
		var limit = info.size * GLUE_LIMIT;
		var first = next.chars[0];
		if (first.width > limit) return true;
		var group = [first];
		var total = first.width;
		for (var i = 1; i < next.chars.length && total <= limit; i++) {
			if (next.chars[i].node !== first.node) return false;
			group.push(next.chars[i]);
			total += next.chars[i].width;
		}
		if (total <= limit) return false;   // 下一行整行都不够这个界限，粘了也没用，不冒险压
		wrap(group, first.node);
		return true;
	}

	/* 把这一串字符包进 nowrap 的 span，断行点就被锁在这块之外了 */
	function wrap(group, node) {
		var from = group[0].index;
		var to = group[group.length - 1].index + 1;
		var text = node.nodeValue.slice(from, to);
		var rest = node.splitText(from);
		rest.nodeValue = rest.nodeValue.slice(to - from);
		var span = document.createElement('span');
		span.className = LINE_HEAD;
		span.textContent = text;
		rest.parentNode.insertBefore(span, rest);
	}

	function applyAll() {
		var blocks = document.querySelectorAll(BLOCK_SEL);
		for (var i = 0; i < blocks.length; i++) {
			var block = blocks[i];
			if (!block.querySelector(FULL_SEL)) continue;
			/* 行盒只有布局完才知道，所以量的是「压之前」的布局，粘接和压缩都拿这一份数据算 */
			var info = layout(block);
			if (!info || info.lines.length < 2) continue;
			for (var li = 0; li < info.lines.length - 1; li++) {
				var line = info.lines[li];
				var tail = line.chars[line.chars.length - 1];
				var holder = tail.node.parentNode;
				if (!holder || !holder.classList || !holder.classList.contains('punct-full')) continue;
				if (!glueHead(info, li)) continue;   // 粘不住就不压，不留「只压不粘」的中间态
				holder.classList.add(LINE_END);
			}
		}
	}

	/* 压缩本身会改变断行，而「这个字要占多宽」量得再准也有误差，所以压完当场再验一次：
	   看那个本该在下一行的字是不是还跟句末号同排。是的话就把它的后面的字一项项黏进
	   粘接块，一直到它掉回下一行 —— 粘接只会让断行更保守，所以这一步一定收敛。 */
	function settle() {
		var ends = document.querySelectorAll('.' + LINE_END);
		for (var i = 0; i < ends.length; i++) {
			var el = ends[i];
			var block = el.closest(BLOCK_SEL);
			var node = el.firstChild;
			if (!block || !node || node.nodeType !== 3 || !node.nodeValue) continue;
			var size = parseFloat(getComputedStyle(block).fontSize) || 16;
			var markTop = rectOf(node, 0).top;
			var head = null;
			for (var step = 0; step < 12; step++) {
				var rest = head ? head.nextSibling : el.nextSibling;
				if (!rest || rest.nodeType !== 3 || !rest.nodeValue) break;
				/* 看「还没粘时的那一项」或「已经粘出来的那一块」是不是还跟句末号同排：
				   本来就在下一行 ⇒ 不用管；还在同一排 ⇒ 再粘一个字进去，直到它塞不下、掉回下一行 */
				if (Math.abs(rectOf(head || rest, 0).top - markTop) >= size * 0.5) break;
				if (!head) {
					head = document.createElement('span');
					head.className = LINE_HEAD;
					rest.parentNode.insertBefore(head, rest);
				}
				head.appendChild(document.createTextNode(rest.nodeValue.charAt(0)));
				rest.nodeValue = rest.nodeValue.slice(1);
			}
		}
	}

	/* 某个字符（在 node 里第 index 个）的盒子 */
	function rectOf(node, index) {
		var rg = document.createRange();
		rg.setStart(node, index);
		rg.setEnd(node, index + 1);
		return rg.getBoundingClientRect();
	}

	function pass() {
		reset();
		applyAll();
		settle();
	}

	/* 合帧去抖：长 setTimeout 会被后台标签页节流到分钟级，用户切回来看到的还是旧排版 */
	function schedule() {
		if (queued) return;
		queued = true;
		requestAnimationFrame(function () {
			queued = false;
			pass();
		});
	}

	/* 视口宽度没变就不用重量，否则自己挂的类会把 ResizeObserver 叫回来，转成死循环 */
	function onResize() {
		var vw = document.documentElement.clientWidth;
		if (vw === lastWidth) return;
		lastWidth = vw;
		schedule();
	}

	function observe() {
		if (!('ResizeObserver' in window)) return;
		var blocks = document.querySelectorAll(BLOCK_SEL);
		var ro = new ResizeObserver(function (entries) {
			var changed = false;
			for (var i = 0; i < entries.length; i++) {
				var el = entries[i].target;
				var w = Math.round(el.getBoundingClientRect().width);
				if (widths.get(el) !== w) {
					widths.set(el, w);
					changed = true;
				}
			}
			if (changed) schedule();
		});
		for (var j = 0; j < blocks.length; j++) ro.observe(blocks[j]);
	}

	function boot() {
		if (!document.querySelector(FULL_SEL)) return;   // 英文页和没有全角句末号的页面直接不动
		lastWidth = document.documentElement.clientWidth;
		pass();
		observe();
		window.addEventListener('resize', onResize);
		if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
	else boot();
})();
