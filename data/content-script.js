self.on("context", function (node) {
    if (node.href || window.getSelection().toString().length > 0) {
    	return true;
    }
});

self.on("click", function (node) {
	var text = window.getSelection().toString();
	self.postMessage(node.href || text);
});
