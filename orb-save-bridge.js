(function () {
  "use strict";

  var PARENT_ORIGIN = "https://orb.games";
  var BRIDGE_VERSION = "1.0.0";
  var timer = null;
  var lastSnapshotJson = "";

  function readLocalStorage() {
    var entries = {};

    try {
      for (var index = 0; index < window.localStorage.length; index += 1) {
        var key = window.localStorage.key(index);
        if (key !== null) {
          entries[key] = window.localStorage.getItem(key);
        }
      }
    } catch (error) {
      return {
        ok: false,
        error: String(error && error.message ? error.message : error),
        entries: {}
      };
    }

    return {
      ok: true,
      error: null,
      entries: entries
    };
  }

  function postToParent(payload) {
    if (window.parent === window) {
      return;
    }

    window.parent.postMessage(payload, PARENT_ORIGIN);
  }

  function sendSnapshot(reason, force) {
    var storage = readLocalStorage();
    var snapshot = {
      type: "orb:save-bridge:snapshot",
      version: BRIDGE_VERSION,
      reason: reason,
      href: window.location.href,
      origin: window.location.origin,
      pathname: window.location.pathname,
      timestamp: Date.now(),
      localStorage: storage
    };
    var snapshotJson = "";

    try {
      snapshotJson = JSON.stringify(snapshot.localStorage.entries);
    } catch (error) {
      snapshotJson = String(Date.now());
    }

    if (!force && snapshotJson === lastSnapshotJson) {
      return;
    }

    lastSnapshotJson = snapshotJson;
    postToParent(snapshot);
  }

  function scheduleSnapshot(reason) {
    window.clearTimeout(timer);
    timer = window.setTimeout(function () {
      sendSnapshot(reason, false);
    }, 250);
  }

  window.addEventListener("message", function (event) {
    if (event.origin !== PARENT_ORIGIN) {
      return;
    }

    if (!event.data || event.data.type !== "orb:save-bridge:request-snapshot") {
      return;
    }

    sendSnapshot("parent-request", true);
  });

  window.addEventListener("storage", function () {
    scheduleSnapshot("storage-event");
  });

  window.addEventListener("pagehide", function () {
    sendSnapshot("pagehide", true);
  });

  window.addEventListener("beforeunload", function () {
    sendSnapshot("beforeunload", true);
  });

  try {
    var originalSetItem = window.localStorage && window.localStorage.setItem;
    var originalRemoveItem = window.localStorage && window.localStorage.removeItem;
    var originalClear = window.localStorage && window.localStorage.clear;

    if (originalSetItem) {
      window.localStorage.setItem = function () {
        var result = originalSetItem.apply(this, arguments);
        scheduleSnapshot("localStorage.setItem");
        return result;
      };
    }

    if (originalRemoveItem) {
      window.localStorage.removeItem = function () {
        var result = originalRemoveItem.apply(this, arguments);
        scheduleSnapshot("localStorage.removeItem");
        return result;
      };
    }

    if (originalClear) {
      window.localStorage.clear = function () {
        var result = originalClear.apply(this, arguments);
        scheduleSnapshot("localStorage.clear");
        return result;
      };
    }
  } catch (error) {
    // Some browsers do not allow replacing Storage methods. The timed snapshot still works.
  }

  postToParent({
    type: "orb:save-bridge:ready",
    version: BRIDGE_VERSION,
    href: window.location.href,
    origin: window.location.origin,
    pathname: window.location.pathname,
    timestamp: Date.now()
  });

  sendSnapshot("load", true);
  window.setInterval(function () {
    sendSnapshot("interval", false);
  }, 10000);
}());
