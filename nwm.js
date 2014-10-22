//     nwm.js
//     (c) 2011 Mikito Takada
//     nwm is freely distributable under the MIT license.
//     Portions of nwm are inspired or borrowed from dwm.

// Modules
// -------

var Collection = require('./lib/collection.js'),
    Monitor = require('./lib/monitor.js'),
    Window = require('./lib/window.js');


function diag() {
    var VERBOSE_DIAG=true;

    if (VERBOSE_DIAG) {
	console.log.apply(null, arguments);
    }
}


var WIN_ACTIVE_BG='#606060';
var WIN_NORMAL_BG='#666666';

// Node Window Manager
// -------------------
var NWM = function() {
  // A reference to the nwm C++ X11 binding - require using node-bindings to work around the various changes in paths
  this.wm = require('bindings')('nwm.node');
  // Known layouts
  this.layouts = {};
  // Keyboard shortcut lookup
  this.shortcuts = [];
  // monitors
  this.monitors = new Collection(this, 'monitor', 0);
  // windows -- this is the global storage for windows, any other objects just store ids referring to this hash.
  this.windows = new Collection(this, 'window', 1);
  this.floaters = [];

  // lever accoutrements
  this.CMD_TITLE='NWM Command Window';
  this.CTL_TITLE='NWM Control Window';

  this.drag_window = null;
  this.ctl_window = null;
  this.cmd_window = null;
}

require('util').inherits(NWM, require('events').EventEmitter);

// Events
// ------
NWM.prototype.events = {
  // Monitor events
  // --------------
  // A new monitor is added
  addMonitor: function(monitor) {
    this.monitors.add(new Monitor(this, monitor));
    this.monitors.current = monitor.id;
  },

  // A monitor is updated
  updateMonitor: function(monitor) {
      diag('update monitor');
    this.monitors.update(monitor.id, monitor);
  },

  // A monitor is removed
  removeMonitor: function(id) {
    diag('Remove monitor', id);
    this.monitors.remove(function(monitor){ return (monitor.id != id); });
  },

  // Window events
  // -------------
  // A new window is added
  addWindow: function(window) {
      diag('add window');
    if(window.id) {
      var current_monitor = this.monitors.get(this.monitors.current);
      window.workspace = current_monitor.workspaces.current;
      // ignore monitor number from binding as windows should open on the focused monitor
      window.monitor = this.monitors.current;

      if(current_monitor.focused_window == null) {
        current_monitor.focused_window = window.id;
      }
      // do not add floating windows
      if(window.isfloating
        // do not add windows that are fixed ( min_width = max_width and min_height = max_height)
        // We need the size info from updatesizehins to do this
        // || (window.width == current_monitor.width && window.height == current_monitor.height)
        ) {
        diag('Ignoring floating window: ', window);
        this.floaters.push(window.id);
        return;
      }
      var win = new Window(this, window);
      // windows might be placed outside the screen if the wm was terminated
      if(win.x > current_monitor.width || win.y > current_monitor.height) {
        win.move(1, 1);
      }
	diag('Add window', {
            window: window,
            current_monitor: {
		width: current_monitor.width,
		height: current_monitor.height
            }
	});
      this.windows.add(win);

    }
  },

  // When a window is removed
  removeWindow: function(window) {

      diag("removing windows...")
      if (window.id == this.cmd_window) {
	  // this really shouldn't happen but just in case
	  this.cmd_window = null;
      }

      // removes window from nwm.windows list...
      this.windows.remove(function(item) {
	  if(item && item.id && window.id) {
              return (item.id != window.id);
	  } else {
              // multiple windows removed simultaneously - item is undefined
              return true;
	  }
      });
      console.log("done removing windows.")
      var pos = this.floaters.indexOf(window.id);
      if(pos > -1) {
	  this.floaters = this.floaters.splice(pos, 1);
      }
      console.log('remove: '+window.id+': '+Object.keys(this.windows.items))
      // moved rearrange here to ensure that it occurs after everything else
      if (false) {
	  var current_monitor = this.monitors.get(this.monitors.current);
	  current_monitor.workspaces.get(current_monitor.workspaces.current).rearrange();
      }
  },

  // When a window is updated
  // This is only triggered for title and class updates, never coordinates or monitors.
  updateWindow: function(window) {
    diag('update window '+window.title);
    if(this.windows.exists(window.id)) {
	console.log('exists title= "'+window.title+'" - "'+this.CMD_TITLE+'"');
	if (window.title == this.CMD_TITLE) {
	    console.log('found command window!'+this.cmd_window+' '+window.id);
	    // this.cmd_window = window.id;
	} else if (window.title == this.CTL_TITLE) {
	    this.ctl_window = window.id;
	}
      var exist = this.windows.get(window.id);
      this.windows.update(window.id, {
        title: window.title || exist.title || '',
        class: window.class || exist.class || ''
      });
    } else {
	console.log('did not find '+window.id);
	console.log(this.windows)
    }
  },

  // When a window requests full screen mode
  fullscreen: function(id, status) {
    diag('Client Fullscreen', id, status);
    diag(id, '!! exists? ', this.windows.exists(id));
    if(this.windows.exists(id)) {
      var window = this.windows.get(id);
      diag(window.monitor, '!! monit exists? ', this.monitors.exists(window.monitor));
      if(!this.monitors.exists(window.monitor)) {
        // TODO handle this error, which occurs when a win was in fullscren and then the monitor was removed, then fullscreen is toggled back
        return;
      }
      // use the monitor dimensions associated with the window
      var monitor = this.monitors.get(window.monitor);
      var workspace = monitor.workspaces.get(monitor.workspaces.current);
      if(status) {
        diag('!! resize', { id: id, x: monitor.x, y: monitor.y, width: monitor.width, height: monitor.height });
        this.wm.moveWindow(id, monitor.x, monitor.y);
        this.wm.resizeWindow(id, monitor.width, monitor.height);
        // we should also protect the window from being disturbed by rearranges
        if(this.layouts['monocle']) {
          workspace.layout = 'monocle';
        }
      } else {
        workspace.rearrange();
      }
    }
  },

  // ConfigureRequest is generated when a client window wants to change its size, stacking order or border width
  configureRequest: function(ev){
    diag('configureRequest', ev);
    this.wm.configureWindow(ev.id, ev.x, ev.y, ev.width, ev.height, ev.border_width,
        ev.above, ev.detail, ev.value_mask);
    return;
    if(ev.id && this.windows.exists(ev.id)) {
      // Check whether the window is known (e.g. managed and not floating)
      // Known windows should not be allowed to reconfigure themselves.
      // They should just be send back a ConfigureNotify() with the current info
      diag('denying configureRequest');
      var window = this.windows.get(id);
      this.wm.notifyWindow(ev.id, window.x, window.y, window.width, window.height, ev.border_width,
        ev.above, ev.detail, ev.value_mask);
    } else {
      diag('allowing configureRequest');
      if(ev.id && this.floaters.indexOf(ev.id)) {
        // If the window is floating, it should be moved and resized
        // The size should be modifiable, but the floating window should be centered
        // on the current monitor (or the monitor the floater is on, but we don't track that now)
        var monitor = this.monitors.get(this.monitors.current);
        ev.x = monitor.x + ev.x;
        ev.y = monitor.y + ev.y;
        if ( (ev.x + ev.width) > monitor.x + monitor.width) {
          ev.x = monitor.x + Math.floor(monitor.width / 2 - ev.width / 2);
        }
        if ( (ev.y + ev.heigth) > monitor.y + monitor.height) {
          ev.y = monitor.y + Math.floor(monitor.height / 2 - ev.height / 2);
        }
      }
      // Unknown windows should be passed through with a XConfigureWindow()
      this.wm.configureWindow(ev.id, ev.x, ev.y, ev.width, ev.height, ev.border_width,
        ev.above, ev.detail, ev.value_mask);
    }
  },

  // Mouse events
  // ------------
  // A mouse button has been clicked
  mouseDown: function(event) {
    this.wm.focusWindow(event.id);
  },

  // A mouse drag is in progress
  mouseDrag: function(event) {
    // move when drag is triggered
      var change_x = event.move_x - event.x;
      var change_y = event.move_y - event.y;
      var done = event.drag_done;
      console.log('DRAG! '+change_x+' '+change_y);
      if (this.drag_window) {
	  var monitor = this.monitors.get(this.monitors.current);
	  var workspace = monitor.workspaces.get(monitor.workspaces.current);
	  this.drag_window(workspace, change_x, change_y, done);
      }
      /* 
	 var window = this.windows.exists(event.id) && this.windows.get(event.id);
	 if(window) {
	 this.wm.moveWindow(event.id, window.x+change_x, window.y+change_y);
	 }
      */
  },

  // Mouse enters a window
  enterNotify: function(event){
    if(this.windows.exists(event.id)) {
      var window = this.windows.get(event.id);
      diag('enterNotify: focused monitor is ', this.monitors.current, 'focusing to', window.monitor, window.title);
      if(this.monitors.exists(window.monitor)) {
        this.monitors.get(window.monitor).focused_window = event.id;
      }
      this.wm.focusWindow(event.id);
      this.setFocusedWindow(event.id);
    } else {
	console.log('WARNING got focus event for nonexistent (transient) window', event);
    }
    // This event is also emitted for the root window
    //  so in any case, we want to set the current monitor based on the event coordinates
    var x = event.x_root || event.x;
    var y = event.y_root || event.y;
    // go through the monitors and find a matching monitor
    var monitor_ids = Object.keys(this.monitors.items);
    var self = this;
    var didChangeFocus = monitor_ids.some(function(monid) {
      var monitor = self.monitors.get(monid);
      if(monitor.inside(x, y)) {
        if(monid != self.monitors.current) {
            diag('Change focused monitor from', self.monitors.current, 'to', monid);
        }
        self.monitors.current = monid;
        return true; // end iteration
      }
      return false; // continue iteration
    });
    if(didChangeFocus) {
	diag('Focus monitor by coordinates', x, y);
	this.wm.focusWindow(event.id);
	this.setFocusedWindow(event.id);
    }
  },

  focusIn: function(event) {
      // we've been redirected to a new window; sort out our bookkeeping
      console.log('focus in event: '+event.id);
      var window = this.windows.get(event.id);
      if(this.monitors.exists(window.monitor)) {
        this.monitors.get(window.monitor).focused_window = event.id;
      }
      
      this.setFocusedWindow(event.id);
  },

  focusOut: function(event) {
      // we're leaving! clean up our bookkeeping
      console.log('focus out event: '+event.id);
      var window = this.windows.get(event.id);
      if(this.monitors.exists(window.monitor)) {
          this.monitors.get(window.monitor).focused_window = null;
      }
      
      this.unsetFocusedWindow(event.id);
  },

  // Screen events
  // -------------
  rearrange: function() {
      diag('rearrange event');
    var self = this;
    // rearrange current workspace on all monitors
    var monitors = Object.keys(this.monitors.items);
    monitors.forEach(function(id) {
      var monitor = self.monitors.get(id);
      monitor.workspaces.get(monitor.workspaces.current).rearrange();
    });
  },

  // Keyboard events
  // ---------------
  // A key has been pressed
  keyPress: function(event) {
      diag('keyPress', event, String.fromCharCode(event.keysym));
    // find the matching callback and emit it
    this.shortcuts.forEach(function(shortcut) {
      if(event.keysym == shortcut.key && event.modifier == shortcut.modifier ) {
        shortcut.callback(event);
      };
    });
  }
};

// Layout operations
// -----------------

// Register a new layout
NWM.prototype.addLayout = function(name, callback){
  this.layouts[name] = callback;
};

// Given the current layout, get the next layout (e.g. for switching layouts via keyboard shortcut)
NWM.prototype.nextLayout = function(name) {
  var keys = Object.keys(this.layouts);
  var pos = keys.indexOf(name);
  // Wrap around the array
  return (keys[pos+1] ? keys[pos+1] : keys[0] );
};

NWM.prototype.setFocusedWindow = function(win) {
    console.log("ACTIVE "+win);
    this.wm.setWindowAttr(win, WIN_ACTIVE_BG);
}

NWM.prototype.unsetFocusedWindow = function(win) {
    console.log("INACTIVE "+win);
    this.wm.setWindowAttr(win, WIN_NORMAL_BG);
}


// Keyboard shortcut operations
// ----------------------------

// Add a new keyboard shortcut
NWM.prototype.addKey = function(keyobj, callback) {
  this.shortcuts.push({ key: keyobj.key, modifier: keyobj.modifier, callback: callback });
};

// Start the window manager
NWM.prototype.start = function(callback) {
  var self = this;
  // Initialize event handlers, bind this in the functions to nwm
  Object.keys(this.events).forEach(function(eventname) {
    self.wm.on(eventname, function() {
      var args = Array.prototype.slice.call(arguments);
      diag('JS: ', eventname, args);
      self.events[eventname].apply(self, args);
    });
  });

  var grab_keys = [];
  diag(this.shortcuts);
  this.shortcuts.forEach(function(shortcut) {
    grab_keys.push( { key: shortcut.key, modifier: shortcut.modifier });
  });
  this.wm.keys(grab_keys);
  this.wm.start();
  if(callback) {
    callback();
  }
};

if (module == require.main) {
  console.log('Please run nwm via "node nwm-user-sample.js" (or some other custom config file).');
}

module.exports = NWM;
