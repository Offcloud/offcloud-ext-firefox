
var {Cc, Ci} = require("chrome");
var win = Cc['@mozilla.org/appshell/window-mediator;1']
            .getService(Ci.nsIWindowMediator)
            .getMostRecentWindow('navigator:browser');
var gBrowser = win.gBrowser;
var gClipboardHelper = Cc["@mozilla.org/widget/clipboardhelper;1"]
                                   .getService(Ci.nsIClipboardHelper);

var Request = require("sdk/request").Request;
var $ = {}
var ajax = {};

ajax.x = function() {

};

ajax.send = function(url, callback, method, data, onFailed) {
    var t = 0;
    var quijote = Request({
      url: url,
      content: data,
      onComplete: function (response) {
        if (typeof(callback) === 'function') {
            res = response.text;
            if (res) {
                res = JSON.parse(res);
            }
            
            callback(res)
        }
      }
    });
    if (method.toLowerCase() == 'get') {
        return quijote.get();
    } else {
        return quijote.post();
    }
};
ajax.request = function(url, obj) {
    var query = [];
    for (var key in obj.data) {
        query.push(encodeURIComponent(key) + '=' + encodeURIComponent(obj.data[key]));
    }
    if (obj.method.toLowerCase() == 'get') {
        ajax.send(url + '?' + query.join('&'), obj.success, 'GET', null, obj.fail);
    } else {
        ajax.send(url, obj.success, 'POST', query.join('&'), obj.fail);
    }
};
ajax.get = function(url, data, callback) {
    var query = [];
    for (var key in data) {
        query.push(encodeURIComponent(key) + '=' + encodeURIComponent(obj.data[key]));
    }
    ajax.send(url + '?' + query.join('&'), callback, 'GET', null)
};

ajax.post = function(url, data, callback) {
    var query = [];
    for (var key in data) {
        query.push(encodeURIComponent(key) + '=' + encodeURIComponent(obj.data[key]));
    }
    ajax.send(url, callback, 'POST', query.join('&'))
};

$.get = ajax.get;
$.post = ajax.post;
$.ajax = ajax.request;
var self_data = require("sdk/self").data;



var cm = require("sdk/context-menu");
var om = require("sdk/self");
var t = require("sdk/tabs");
var remoteOptionId;
var s = require("sdk/simple-storage").storage;
var cn = require("sdk/notifications");
var panel = require("sdk/panel");
var pageMod = require('sdk/page-mod');

var APIURLS = {
    instantDld: 'https://offcloud.com/api/instant/download',
    cloudDld: 'https://offcloud.com/api/cloud/download',
    remoteDld: 'https://offcloud.com/api/remote/download',
    login: 'https://www.offcloud.com/login',
    checkLogin: 'https://offcloud.com/api/login/check',
    getRemoteId: 'https://offcloud.com/api/remote-account/list',
    remoteSet: 'https://www.offcloud.com/#/remote'
};

function initMenus() {
    //cm.removeAll();
    var script = 'self.on("click", self.postMessage);'

    cm.Menu({
      label: "Offcloud.com extension",
      context: cm.SelectorContext("*"),
      image: self_data.url("logo.png"),
      items: [
        cm.Item({
            label: "Instant download selected links",
            contentScriptFile: self_data.url("content-script.js"),
            onMessage: function (href) {
                downloadAction(href, "tab", APIURLS.instantDld, false);
            }
        }),
        cm.Item({
            label: "Cloud download selected links",
            contentScriptFile: self_data.url("content-script.js"),
            onMessage: function (href) {
                downloadAction(href, "tab", APIURLS.cloudDld, false);
            }
        }),
        cm.Item({
            label: "Remote download selected links",
            contentScriptFile: self_data.url("content-script.js"),
            onMessage: function (href) {
                downloadAction(href, "tab", APIURLS.remoteDld, true);
            }
        }),
        cm.Separator({
            contentScriptFile: self_data.url("content-script.js"),
        }),
        cm.Item({
            label: "Instant download custom links",
            contentScript: script,
            onMessage: function () {
                customDownload("tab", 0);
            }
        }),
        cm.Item({
            label: "Cloud download custom links",
            contentScript: script,
            onMessage: function () {
                customDownload("tab", 1);
            }
        }),
        cm.Item({
            label: "Remote download custom links",
            contentScript: script,
            onMessage: function () {
                customDownload("tab", 2);
            }
        })
      ]
    });

}
initMenus();

$.get(APIURLS.getRemoteId, function (data) {
    console.log('remoe ',data);
    if (data && data[0] != "<") {
        localStorage.remoteOptionId = remoteOptionId = data.data[0].remoteOptionId;
    } else if (data[0] == "<") {

    } else {
        showNoRemoteSetNotify();
    }
});

function checkRemoteSet() {
    if (!remoteOptionId) {
        showNoRemoteSetNotify();
        return false;
    }
}

function isUrl(s) {
    var regexp = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
    return regexp.test(s);
}
function downloadAction(data, tab, api, remote) {
    if (isUrl(data)) {
        checkLogin(function () {
            ajaxCall(api, data, remote, tab);
        });
    } else {
        processMultipleLink(data, true, remote, tab, api);
    }
}

function customDownload(tab, type) {
    s.customType = type;
    s.showType = "custom";
    showModal(tab);
}


function processMultipleLink(html, needReg, remote, tab, api) {
    var result = [];
    if (needReg) {
        result = findLinkByRegex(html);
        if (!result) {
            result = findLinkByText(html);
        }
    } else {
        result = findLinkByText(html);
    }

    checkLogin(function () {
        if (result && result.length > 1) {
            var requestList = [];
            for (var i = 0; i < result.length; i++) {
                var dataBody = { url: result[i]};
                if (remote) {
                    checkRemoteSet();
                    dataBody.remoteOptionId = remoteOptionId;
                }
                requestList.push($.ajax(api, {
                    method: 'POST',
                    data: dataBody,
                    fail: function() {
                        showErrorMessage();
                    }
                }));
            }
            var multiRequest = $.when.apply($, requestList);
            multiRequest.done(function (data) {
                var finalData = [];
                $.each(arguments, function (index, responseData) {
                    if (responseData[1] == "success") {
                        if (responseData[0].not_available) {
                            s.result = responseData[0];
                            s.isList = false;
                            s.showType = "default";
                            showModal(tab);
                            return false;
                        } else {
                            if (remote) {
                                checkRemoteSet();
                                s.result = {remote: 'Transfer is in progress...'};
                                s.isList = false;
                                s.showType = "default";
                                showModal(tab);
                                return false;
                            } else {
                                finalData.push(responseData[0].url);
                            }
                        }
                    } else {
                        var data = {error: "unknown"};
                        s.result = data;
                        s.isList = false;
                        s.showType = "default";
                        showModal(tab);
                    }
                });

                if (finalData.length != 0) {
                    s.result = finalData;
                    s.isList = true;
                    s.showType = "default";
                    showModal(tab);
                }
            });
        } else if (result && result.length == 1) {
            ajaxCall(api, result[0], remote, tab);
        }

    });
}

function findLinkByRegex(html) {
    var linkReg = /href=[\'"]?([^\'" >]+)/g;
    var result = html.match(linkReg);
    if (result) {
        for (var i = 0; i < result.length; i++) {
            result[i] = result[i].replace('href="', '');
        }
    }
    return result;
}

function findLinkByText(text) {
    var urlReg = /[a-zA-z]+:\/\/[^\s]*/g;
    return text.match(urlReg);
}

function ajaxCall(api, link, remote, tab) {
    var dataBody = { url: link};
    if (remote) {
        checkRemoteSet();
        dataBody.remoteOptionId = remoteOptionId;
    }
    $.ajax(api, {
        method: 'POST',
        data: dataBody,
        success: function(data) {
            if (!data.not_available && remote) {
                data = {remote: 'Transfer is in progress...'};
            }
            s.result = data;
            s.isList = false;
            s.showType = "default";
            showModal(tab);
        },
        fail: function() {
            var data = {error: "unknown"};
            s.result = data;
            s.isList = false;
            s.showType = "default";
            showModal(tab);
        }
    });
}


function showModal(tab) {
    var text_entry = panel.Panel({
        width: 500,
        contentURL: self_data.url("notify.html"),
        contentScriptFile: [self_data.url('lib/jquery-2.0.3.min.js'),
                                self_data.url('lib/bootstrap.min.js'),
                                self_data.url("show-result.js")],
        contentScriptOptions: {
            storage: s
        },
        onMessage: function(obj, callback) {
            var cmd = obj.cmd;
            if (cmd == "copy") {
                var content = obj.content;
                copyTextToClipboard(content);
                if (callback) {
                    callback({res: 'done'});
                }
                
            } else if (cmd == "removeFrame") {
                this.hide();
            } else if (cmd == "custom") {
                this.hide();
                var currentApi;
                if (obj.remote == 0) {
                    currentApi = APIURLS.instantDld;
                } else if (obj.remote == 1) {
                    currentApi = APIURLS.cloudDld;
                } else {
                    currentApi = APIURLS.remoteDld;
                }
                processMultipleLink(obj.html, false, obj.remote == 2, "sender.tab", currentApi);
            }
        }
    });

    text_entry.show();
}


function checkLogin(callback) {
    showLoading();
    $.ajax(APIURLS.checkLogin, {
        method: 'POST',
        success: function(data) {
            if (data.loggedIn != 1) {
                notifyNotLogedIn();
            } else {
                callback();
            }
        },
        fail: function() {
            showErrorMessage();
        }
    })
}


function copyTextToClipboard(text) {
    gClipboardHelper.copyString(text);
}

function showErrorMessage() {
    showNotification("errorMsg",
        { type: "basic",
            title: ' Offcloud.com is offline',
            message: 'Sorry, Offcloud.com is offline, please try again later'});
}

function notifyNotLogedIn() {
    showNotification("notlogin",
        { type: "basic",
            title: 'You are currently not logged in',
            message: 'You are currently not logged into Offcloud. Please log into your account...'},
        true,
        APIURLS.login);
}

function showNoRemoteSetNotify() {
    showNotification("noRemote",
        {type: "basic",
            title: "Remote Not Setted",
            message: "Please set your remote download account first"},
        true,
        APIURLS.remoteSet);
}

function showNotification(name, options, redirect, redirectUrl) {
    cn.notify({
        title: options.title,
        text: options.message,
        onClick: function (data) {
            if (redirect) {
                gBrowser.selectedTab = win.gBrowser.addTab(redirectUrl);
                //t.create({active: true, url: redirectUrl});
            }
        }
    });
    if (redirect) {
        gBrowser.selectedTab = win.gBrowser.addTab(redirectUrl);
        //t.create({active: true, url: redirectUrl});
    }
}

function showLoading() {
    cn.notify({
        title: 'Please wait!',
        text: 'Connecting..'
    });
}


/*
    }, false);
})();
*/

