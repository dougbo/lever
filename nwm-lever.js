// modules
var NWM = require('./nwm.js'),
    XK = require('./lib/keysymdef.js'),
    Xh = require('./lib/x.js'),
    child_process = require('child_process');

// instantiate nwm and configure it
var nwm = new NWM();

// load layouts
var layouts = require('./lib/layouts');
nwm.addLayout('lever', layouts.lever);
nwm.addLayout('tile', layouts.tile);
nwm.addLayout('monocle', layouts.monocle);

// convinience functions for writing the keyboard shortcuts
function currentMonitor() {
  return nwm.monitors.get(nwm.monitors.current);
}

function moveToMonitor(window, currentMonitor, otherMonitorId) {
  if (window) {
    window.monitor = otherMonitorId;
    // set the workspace to the current workspace on that monitor
    var otherMonitor = nwm.monitors.get(otherMonitorId);
    window.workspace = otherMonitor.workspaces.current;
    // rearrange both monitors
    currentMonitor.workspaces.get(currentMonitor.workspaces.current).rearrange();
    otherMonitor.workspaces.get(otherMonitor.workspaces.current).rearrange();
  }
}

function resizeWorkspace(increment) {
  var workspace = currentMonitor().currentWorkspace();
  workspace.setMainWindowScale(workspace.getMainWindowScale() + increment);
  workspace.rearrange();
}

// KEYBOARD SHORTCUTS
// Change the base modifier to your liking e.g. Xh.Mod1Mask if you just want to use the meta key without Ctrl
// Using Mod1 which maps to alt as friendlier on Apple keyboards
var baseModifier = Xh.Mod1Mask; // Alt key

if ( process.env.DISPLAY && process.env.DISPLAY == ':1' ) {
  baseModifier = Xh.Mod1Mask|Xh.ControlMask; // Alt + Ctrl
}

var keyboard_shortcuts = [
  {
    key: [1, 2, 3, 4, 5, 6, 7, 8, 9], // number keys are used to move between screens
    callback: function(event) {
      currentMonitor().go(String.fromCharCode(event.keysym));
    }
  },
  {
    key: [1, 2, 3, 4, 5, 6, 7, 8, 9], // with shift, move windows between workspaces
    modifier: [ 'shift' ],
    callback: function(event) {
      var monitor = currentMonitor();
      monitor.windowTo(monitor.focused_window, String.fromCharCode(event.keysym));
    }
  },
  {
    key: 'Return', // enter key launches xterm
    modifier: [ 'shift' ],
    callback: function(event) {
      child_process.spawn('xterm', ['-lc'], { env: process.env });
    }
  },
  {
    key: 'c', // c key closes the current window
    modifier: [ 'shift' ],
    callback: function(event) {
      var monitor = currentMonitor();
      monitor.focused_window && nwm.wm.killWindow(monitor.focused_window);
    }
  },
    {
	key: 'Right',
	modifier: [ 'shift' ],
	callback: function(event) {
	    if (nwm.onDrag) {
		var monitor = currentMonitor();
		var workspace = monitor.currentWorkspace();
		nwm.onDrag(workspace, 3*monitor.width/4, 0, true);
	    }
	}
    },
    {
	key: 'Left',
	modifier: [ 'shift' ],
	callback: function(event) {
	    if (nwm.onDrag) {
		var monitor = currentMonitor();
		var workspace = monitor.currentWorkspace();
		nwm.onDrag(workspace, -3*monitor.width/4, 0, true);
	    }
	}
    },
  {
    key: 'space', // space switches between layout modes
    callback: function(event) {
	nwm.onDrag = null;
      var monitor = currentMonitor();
      var workspace = monitor.currentWorkspace();
      workspace.layout = nwm.nextLayout(workspace.layout);
      // monocle hides windows in the current workspace, so unhide them
      monitor.go(monitor.workspaces.current);
      workspace.rearrange();
    }
  },
  {
    key: ['h', 'F10'], // shrink master area
    callback: function(event) {
      resizeWorkspace(-5);
    }
  },
  {
    key: ['l', 'F11'], // grow master area
    callback: function(event) {
      resizeWorkspace(+5);
    }
  },
  {
    key: 'Tab', // tab makes the current window the main window
    callback: function(event) {
      var monitor = currentMonitor();
      var workspace = monitor.currentWorkspace();
      workspace.mainWindow = monitor.focused_window;
      workspace.rearrange();
    }
  },
  {
    key: 'comma', // moving windows between monitors
    modifier: [ 'shift' ],
    callback: function(event) {
      var monitor = currentMonitor();
      var window = nwm.windows.get(monitor.focused_window);
      if(window) { // empty if no windows
        moveToMonitor(window, monitor, nwm.monitors.next(window.monitor));
      }
    }
  },
  {
    key: 'period', // moving windows between monitors
    modifier: [ 'shift' ],
    callback: function(event) {
      var monitor = currentMonitor();
      var window = nwm.windows.get(monitor.focused_window);
      if(window) { // empty if no windows
        moveToMonitor(window, monitor, nwm.monitors.prev(window.monitor));
      }
    }
  },
  {
    key: 'j', // moving focus
    callback: function() {
      var monitor = currentMonitor();
      if(monitor.focused_window && nwm.windows.exists(monitor.focused_window)) {
        var window = nwm.windows.get(monitor.focused_window);
        do {
          var previous = nwm.windows.prev(window.id);
          window = nwm.windows.get(previous);
        }
        while(window.workspace != monitor.workspaces.current);
        console.log('Current', monitor.focused_window, 'previous', window.id);
        monitor.focused_window = window.id;
        nwm.wm.focusWindow(window.id);
      }
    }
  },
  {
    key: 'k', // moving focus
    callback: function() {
      var monitor = currentMonitor();
      if(monitor.focused_window && nwm.windows.exists(monitor.focused_window)) {
        var window = nwm.windows.get(monitor.focused_window);
        do {
          var next = nwm.windows.next(window.id);
          window = nwm.windows.get(next);
        }
        while(window.workspace != monitor.workspaces.current);
        console.log('Current', monitor.focused_window, 'next', window.id);
        monitor.focused_window = window.id;
        nwm.wm.focusWindow(monitor.focused_window);
      }
    }
  },
  {
    key: 'q', // quit
    modifier: [ 'shift' ],
    callback: function() {
      process.exit();
    }
  },
  {
    key: 'BackSpace',
    callback: function() {
      currentMonitor().goBack();
    }
  }
];

// take each of the keyboard shortcuts above and make add a key using nwm.addKey
keyboard_shortcuts.forEach(function(shortcut) {
  var callback = shortcut.callback;
  var modifier = baseModifier;
  // translate the modifier array to a X11 modifier
  if(shortcut.modifier) {
    (shortcut.modifier.indexOf('shift') > -1) && (modifier = modifier|Xh.ShiftMask);
    (shortcut.modifier.indexOf('ctrl') > -1) && (modifier = modifier|Xh.ControlMask);
  }
  // add shortcuts
  if(Array.isArray(shortcut.key)) {
    shortcut.key.forEach(function(key) {
      nwm.addKey({ key: XK[key], modifier: modifier }, callback);
    });
  } else {
    nwm.addKey({ key: XK[shortcut.key], modifier: modifier }, callback);
  }
});


// set up a server waiting for API commands
var express = require('express');
var app = express();
var bodyParser = require('body-parser');


app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var port = process.env.PORT || 8080;

var router = express.Router();
var API_VERSION = 'v1'

// all routes start with /api
app.use('/api/'+API_VERSION, router);

// api:

// GET /windows -> [ windowid1, ... ]
// GET /windows/info -> [ { id, title, x, y, ... }, ... ]

// [current window]
// GET /window/id
// GET /window/info
// PUT /window/close

// GET /window/:window_id/info
// PUT /window/:window_id/focus
// PUT /window/:window_id/close
// PATCH /window/:window_id/title/:title


// PUT /layout/:layout_name
// PUT /layout/rotate/:f_b


// PUT /layout/lever/mode/:n_up

router.use(function(req, res, next) {
    next();
})

router.get('/', function(req, res) {
    res.json({ message: 'got /api root' });
});

// ROUTES for the NWM API
router.route('/windows')
    .get(function(req, res) {
	var windows_res = [];
	var monitor = currentMonitor();
        var window = nwm.windows.get(monitor.focused_window);
	var first_window = window.id;
        do {
	    windows_res.push(window.id);
            var next = nwm.windows.next(window.id);
            window = nwm.windows.get(next);
        }
        while(window.id != first_window);
	res.json(windows_res);
    });



router.route('/windows/info')
    .get(function(req, res) {
	var windows_res = []
	var windows = nwm.windows;
	for (window_id in windows.items) {
	    var window = windows.get(window_id);
	    var info = {id: window.id,
			title: window.title,
			x: window.x,
			y: window.y,
			width: window.width,
			height: window.height};
	    windows_res.push(info)
	}
	res.json(windows_res);
    });

router.route('/window/id')
    .get(function(req, res) {
	// window id of current focused window
	var monitor = currentMonitor();
	res.json(monitor.focused_window);
    }); 


function win_info(window_id) {
    var window = nwm.windows.get(window_id);
    
    var info = {id: window.id,
		title: window.title,
		x: window.x,
		y: window.y,
		width: window.width,
		height: window.height}

    return info;
}

router.route('/window/info')
    .get(function(req, res) {
	var monitor = currentMonitor()
	res.json(win_info(monitor.focused_window));
    }); 

router.route('/window/:window_id/info')
    .get(function(req, res) {
	var window_id = req.params.window_id;
	if (!nwm.windows.exists(window_id)) {
	    res.status(404);
	    res.json({err: 'window does not exist'});
	} else {
	    res.json(win_info(window_id));
	}
    });

function win_focus(window_id) {
    var monitor = currentMonitor();
    var workspace = monitor.currentWorkspace();

    var window = nwm.windows.get(monitor.focused_window);
    window.hide();
    monitor.focused_window = window_id;
    window = nwm.windows.get(monitor.focused_window);
    window.show();

    workspace.rearrange();
    return {}
}

// TODO: focus with no window_id focuses on the window behind the current focused_window

router.route('/window/:window_id/focus')
    .put(function(req, res) {
	var window_id = req.params.window_id;

	if (nwm.windows.exists(window_id)) {

	    res.json(win_focus(window_id));
	    return;
	}

	res.status(404);
	res.json({err: 'window dooes not exist'});
    });

function win_close(window_id) {
    var workspace = monitor.currentWorkspace();
    nwm.wm.killWindow(window_id);
    workspace.rearrange();
}

router.route('/window/close')
    .put(function(req, res) {
	var monitor = currentMonitor()
	console.log('WIN to close: '+monitor.focused_window);
	win_close(monitor.focused_window);
	res.json({})
    });

router.route('/window/:window_id/close')
    .put(function(req, res) {
	var window_id = req.params.window_id;
	if (!nwm.windows.exists(window_id)) {
	    res.status(404);
	    res.json({err: 'window does not exist'});
	} else {
	    win_close(window_id);
	    res.json({});
	}
    });
	
router.route('/window/:window_id/title/:title')
    .patch(function(req, res) {
	var window_id = req.params.window_id;
	var new_title = req.params.title
	console.log('patch title -> '+new_title)
	if (!nwm.windows.exists(window_id) || typeof(new_title) == 'undefined') {
	    res.status(404);
	    res.json({err: 'window does not exist'});
	} else {
	    var monitor = currentMonitor();
	    var workspace = monitor.currentWorkspace();

	    var window = nwm.windows.get(window_id);
	    window.title = new_title;
	    workspace.rearrange();

	    res.json({});
	}
    }); 
	
	
router.route('/layout/:layout_mode')
    .put(function(req, res) {
	var layout_mode = req.params.layout_mode;
	console.log('in layout put mode='+layout_mode);
	if (layout_mode in nwm.layouts) {
	    var monitor = currentMonitor();
	    var workspace = monitor.currentWorkspace();

	    workspace.layout = layout_mode;

	    // monocle hides windows in the current workspace, so unhide them
	    monitor.go(monitor.workspaces.current);
	    if (layout_mode == 'lever') {
		// start our in 1-up mode
		workspace.n_up = '1';
	    }

	    workspace.rearrange();
	    res.json({})
	} else {
	    res.status(404);
	    res.json({err: 'layout does not exist'});
	}
    });

router.route('/layout/rotate/:f_b')
    .put(function(req, res) {
	var f_b = req.params.f_b;
	if (f_b == 'f' || f_b == 'b') {
	    var monitor = currentMonitor();
	    var workspace = monitor.currentWorkspace();
	    var windows = nwm.windows;

	    var ids = Object.keys(windows.items);
	    console.log('IDS: ');
	    console.log(ids);
	    var mainId = workspace.mainWindow.toString();
	    var winAt = ids.indexOf(mainId);
	    console.log('winAt: '+winAt+' '+mainId);
	    if (winAt < 0) {
		res.status(500);
		res.json({err: 'Window '+mainId+' not found'});
		return;
	    }

	    if (f_b == 'b') {
		winAt = winAt -1;
		if (winAt < 0) {
		    // wrap back
		    winAt = ids.length-1;
		}
	    } else {
		winAt = winAt + 1
		if (winAt >= ids.length) {
		    // wrap forward
		    winAt = 0;
		}
	    }
	    var newMainId = ids[winAt];
	    console.log('main window: '+mainId);
	    console.log('new main: '+newMainId+' '+winAt);

	    monitor.mainWindow = ids[winAt];
	    var window = windows.get(mainId);
	    window.hide();
	    window = windows.get(newMainId);
	    window.show();

	    workspace.rearrange();
	    res.json({})
	} else {
	    res.status(404);
	    res.json({err: 'layout does not exist'});
	}
    });

router.route('/layout/lever/mode/:n_up')
    .put(function(req, res) {
	var n_up = req.params.n_up;
	console.log('in layout put mode='+n_up);
	var monitor = currentMonitor();
	var workspace = monitor.currentWorkspace();

	if (workspace.layout != 'lever') {
	    res.status(404);
	    res.json({err: 'current layout is not "lever"'});
	} else {

	    // set lever to 1/2 up 
	    if (n_up != '1' && n_up != '2') {
		res.status(400); // bad request
	    } else {
		workspace.n_up = n_up;
		workspace.rearrange();
	    }

	    res.json({})
	}
    });



app.listen(port);
console.log('Listening: '+port);

// START
nwm.start(function() { });
