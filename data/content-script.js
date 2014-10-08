function getParentLink(node) {
    // dirty way to find anchor parents, for firefox
    var parent = node.parentNode;
    if(parent.parentNode && parent.parentNode.href) {
        parent = parent.parentNode;
    } else if (parent.parentNode && parent.parentNode.parentNode && parent.parentNode.href) {
        parent = parent.parentNode.parentNode;
    }
    return parent.href;
}

self.on("context", function (node) {
    var href = node.href || getParentLink(node);
    if (href || window.getSelection().toString().length > 0) {
    	return true;
    }
});

self.on("click", function (node) {
	var text = window.getSelection().toString();
	self.postMessage(node.href || text);
});
