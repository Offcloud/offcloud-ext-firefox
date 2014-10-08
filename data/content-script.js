function getParentLinkRecr(node) {
    if(node.parentNode) {
        if (node.parentNode.href) {
            return node.parentNode.href
        } else {
            return getParentLinkRecr(node.parentNode)
        }
    }
    return null;
}

self.on("context", function (node) {
    var href = node.href || getParentLinkRecr(node);
    if (href || window.getSelection().toString().length > 0) {
    	return true;
    }
});

self.on("click", function (node) {
	var text = window.getSelection().toString(),
        href = node.href || getParentLinkRecr(node);
	self.postMessage(href || text);
});
