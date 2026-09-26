/**
 * 中西空隙兜底
 * ------------
 * 正式方案是 html 上的 text-autospace: normal（全站继承）。这件事不能按内核名字猜：
 * Safari 18.4+ 跟 Firefox 145+ 都支持这条声明，可 Safari 的实现只在同一个文本节点里让空，
 * 跨行内元素的交界（「…知道<a>B 站</a>…」里的「道」和「B」）照样贴着；
 * 反过来有些 Chromium 和 Electron 构建里 CSS.supports('text-autospace','normal') 返回 false，
 * 属性却明明生效。所以这里改成实测：量一次「这个内核在这处到底补不补」，
 * 同一个文本节点里的和跨行内元素的分开量，哪处不补就只在那种交界上插一个空元素。
 * 只插空元素、不动文字，所以复制和搜索索引读到的还是原文；重复执行也不会叠加。
 * 必须排在行尾标点压缩（typography.js）之前：插空隙会改横向位置，行尾得在之后重新量。
 */
(function () {
	'use strict';

	var GAP_CLASS = 'cjk-latin-gap';
	/* 这些里面是代码或原始内容，断开而且不进去 */
	var SKIP_INSIDE = { PRE: 1, CODE: 1, KBD: 1, SAMP: 1, SCRIPT: 1, STYLE: 1, TEXTAREA: 1, SVG: 1 };
	/* 只放汉字：实测内核只在汉字跟西文数字之间让空，标点那头不让（，A、。A、（A、！A 量出来都是 0），
	   兜底跟着同样的范围走，免得老内核反倒比新内核多出一截空隙 */
	var CJK = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]|[\u{20000}-\u{2FA1F}]/u;
	var LATIN = /[A-Za-z0-9]/;
	var BLOCKISH = /^(block|flow-root|flex|grid|list-item|table|table-row|table-cell|table-caption|table-row-group|table-header-group|table-footer-group)$/;
	var container = document.body;
	if (!container) return;

	/* 量一次内核在这处交界上会不会自己让空。量的是整串宽度差，不要量两个字之间的距离 ——
	   内核把那点空隙算进了字的盒子里，量距离永远是 0。 */
	function nativeGapAt(crossElement) {
		var probe = document.createElement('span');
		probe.setAttribute('aria-hidden', 'true');
		var bodyStyle = getComputedStyle(container);
		probe.style.cssText = 'position:absolute;left:-9999px;top:0;white-space:pre;';
		probe.style.fontFamily = bodyStyle.fontFamily;
		probe.style.fontSize = bodyStyle.fontSize;
		probe.style.fontWeight = bodyStyle.fontWeight;
		probe.style.fontStyle = bodyStyle.fontStyle;
		probe.style.setProperty('text-autospace', 'normal');   // 基准要显式给，别指望继承
		if (crossElement) {
			probe.appendChild(document.createTextNode('道'));
			var inner = document.createElement('span');
			inner.textContent = 'B';
			probe.appendChild(inner);
		} else {
			probe.textContent = '道B';
		}
		container.appendChild(probe);
		var withGap = probe.getBoundingClientRect().width;
		probe.style.setProperty('text-autospace', 'no-autospace');
		var withoutGap = probe.getBoundingClientRect().width;
		probe.remove();
		return withGap - withoutGap > 0.5;
	}

	var nativeInSameNode = nativeGapAt(false);
	var nativeAcrossElements = nativeGapAt(true);
	if (nativeInSameNode && nativeAcrossElements) return;   // 两处内核都自己让空，一处都不用插

	/* 块级元素按「断开但继续往下走」处理：正文都在 <p> 里，不进去就一处也插不出来 */
	function isBlockChild(el) {
		return BLOCKISH.test(getComputedStyle(el).display);
	}

	/* 摊平成一串：相邻的两个字符才算一对，块级元素、<br>、代码段都只是断开 */
	function flatten(list, node) {
		for (var child = node.firstChild; child; child = child.nextSibling) {
			if (child.nodeType === 3) {
				var value = child.nodeValue;
				for (var i = 0; i < value.length; i++) list.push({ node: child, index: i, ch: value.charAt(i) });
				continue;
			}
			if (child.nodeType !== 1) continue;
			if (child.classList && child.classList.contains(GAP_CLASS)) { list.push({ br: true }); continue; }   // 这儿已经有空隙，别再插一个
			if (SKIP_INSIDE[child.tagName] || child.tagName === 'BR') { list.push({ br: true }); continue; }
			if (isBlockChild(child)) {
				list.push({ br: true });
				flatten(list, child);
				list.push({ br: true });
				continue;
			}
			flatten(list, child);
		}
	}

	function insertGapBefore(point) {
		var gap = document.createElement('span');
		gap.className = GAP_CLASS;
		gap.setAttribute('aria-hidden', 'true');
		if (point.index <= 0) {
			point.node.parentNode.insertBefore(gap, point.node);
			return;
		}
		var rest = point.node.splitText(point.index);
		rest.parentNode.insertBefore(gap, rest);
	}

	function fill(list) {
		var pending = [];
		for (var i = 1; i < list.length; i++) {
			var a = list[i - 1];
			var b = list[i];
			if (a.br || b.br) continue;
			if (!((CJK.test(a.ch) && LATIN.test(b.ch)) || (LATIN.test(a.ch) && CJK.test(b.ch)))) continue;
			var native = (a.node === b.node && b.index === a.index + 1) ? nativeInSameNode : nativeAcrossElements;
			if (native) continue;
			pending.push(b);
		}
		/* 倒着插：splitText 会把文本节点切开，先处理靠后的位置，前面的下标才还成立 */
		for (var k = pending.length - 1; k >= 0; k--) insertGapBefore(pending[k]);
	}

	var list = [];
	flatten(list, container);
	fill(list);
})();
