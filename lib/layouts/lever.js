/**
 * lever (a.k.a. fullscreen, with mods)
 *
 *  +---------------------+
 *  |                     |
 *  |                     |
 *  |                     |
 *  |                     |
 *  |                     |
 *  |                     |
 *  |                     |
 *  +---------------------+
 *  |    <ui controls>    |
 *  +---------------------+
 *  |    <cmd window>     |
 *  +---------------------+
 *
 */

var x11 = require('x11'),
    child_process = require('child_process');


// geometry of cmd/ctrl windows
var UI_MARGIN=10; // n-pixel margin around windows
var UI_CTL_HEIGHT=20 // height area where UI controls live (between workspace and cmd)
var UI_CMD_HEIGHT=40 // height of command window that's set up at the bottom of the screen

var two_up = false; // 1-up or 2-up

function get_window_ids(workspace) {

    // the visible windows are the main window, plus one 
    // to the right if in 2-up mode
    var nwm = workspace.nwm
    var windows = nwm.windows.items;
    var window_ids = Object.keys(windows);

    // for now, get a stable order by sorting id's -- eventually, we want to be able to
    // reorder windows
    window_ids.sort();

    var mainId = workspace.mainWindow.toString();

    // remove the command and control id's from the set of visible/hidden windows so that we 
    // don't maximize them, and don't screw around with their visibility
    var cmdId = nwm.cmd_window && workspace.nwm.cmd_window.toString();
    var ctlId = nwm.ctl_window && workspace.nwm.ctl_window.toString();
    if (cmdId || ctlId) {
	window_ids = window_ids.filter(function(id) { return (id != cmdId && id != ctlId); });
    }

    console.log('get window ids: '+workspace.nwm.cmd_window+' = '+window_ids);
    var mainWin = nwm.windows.get(mainId);
    var mainIdx = window_ids.indexOf(mainId);

    // find the window to the "left" and "right" of the main window, taking into account that 
    // there are more than one visible windows when in 2-up mode
    var leftIdx = mainIdx-1;
    if (leftIdx < 0) leftIdx = window_ids.length-1;

    var visible = [];
    visible.push(mainId);
    if (workspace.n_up == '2') {
	// figure out who's adjacent to mainWin
	mainIdx = (mainIdx + 1) % window_ids.length;
	visible.push(window_ids[mainIdx]);
    }
    var rightIdx = (mainIdx+1) % window_ids.length;
    
    hidden = window_ids.filter(function(id) { 
	return (visible.indexOf(id) == -1); 
    });

    return {mainId: mainId, 
	    visible: visible, 
	    hidden: hidden, 
	    cmdId: cmdId,
	    ctlId: ctlId,
	    rightId: window_ids[rightIdx], 
	    leftId: window_ids[leftIdx]}
}

function dragWindow(workspace, delta_x, delta_y, done) {
    // move the work window left or right (animated, pointer-initiated)

    var window_ids = get_window_ids(workspace);

    var visible = window_ids.visible;
    var hidden = window_ids.hidden;
    var mainId = window_ids.mainId;
    var rightId = window_ids.rightId;
    var leftId = window_ids.leftId;
    var mainWin = workspace.nwm.windows.get(mainId);

    if (hidden.length == 0) return;

    // shift the visible windows; reset their x positions
    var windows = workspace.nwm.windows.items;

    delta_x = Math.floor(delta_x)
    var x = mainWin.x + delta_x;
    var y = mainWin.y; // ignore delta y
    var width = mainWin.width;

    visible.forEach(function(id, index) {
	var win = windows[id];
	win.move(x, y);

	x += width;
    });

    function resetMainWindow(win) {
	// done animating -- reset the main window
	console.log('SWIPE: reset '+win);

	var screen = workspace.monitor;
	
	win.x = screen.x+UI_MARGIN;
	win.show();
	workspace.mainWindow = win.id;
    }
    var SWIPE_FPS=10
    function swipeRight(delta, win) {
	console.log('SWIPE Right: '+delta);
	if (delta <= 1) {
	    resetMainWindow(win)
	} else {
	    dragWindow(workspace, delta, 0, false);
	    setTimeout(function() { 
		swipeRight(delta /2, win)}, 100);
	}
    }
    function swipeLeft(delta, win) {
	console.log('SWIPE Left: '+delta);

	// DBO: xxx after a whole bunch of experimentation I suspect
	// chromoting of freaking out when there are right-to-left
	// block movements of screen real estate.
	resetMainWindow(win);
	return;

	if (delta >= -1) {
	    resetMainWindow(win);
	} else {
	    dragWindow(workspace, delta, 0, false);
	    setTimeout(function() { 
		swipeLeft(delta /2, win)}, 100);
	}
    }


    if ((mainWin.x + delta_x) > 0) {
	// swiping to the right
	var leftWin = workspace.nwm.windows.get(leftId);

	if (done) {
	    // if done dragging, either animate the new window into the main
	    // position or animate back to square one i fthe user doesn't seem serious
	    
	    if (mainWin.x >= (mainWin.width/8)) {
		// if we're more than 1/8 dragged over, assume we were serious
		var delta = (mainWin.width - mainWin.x) / 2 + 1;
		swipeRight(delta, leftWin);
	    } else {
		// half hearted... snap back
		resetMainWindow(mainWin);
	    }

	    return;
	}

	// further reveal the window to the left
	var new_x = -(leftWin.width + UI_MARGIN) + mainWin.x;
	leftWin.move(new_x, mainWin.y);
    } else {
	// swiping to the left
	var rightWin = workspace.nwm.windows.get(rightId);

	if (done) {
	    // if done dragging, either animate the new window into the main
	    // position or animate back to square one if the user doesn't seem serious

	    if (delta_x+mainWin.x+mainWin.width < (7*mainWin.width/8)) {
		var delta = -((mainWin.width+mainWin.x) / 2);
		swipeLeft(delta, rightWin);
	    } else {
		// half hearted... snap back
		resetMainWindow(mainWin);
	    }

	    return;
	}

	// further reveal the window to the right
	var new_x = mainWin.x + (mainWin.width + UI_MARGIN)*visible.length;
	rightWin.move(new_x, mainWin.y);
    }
}

function createUiControls(workspace, x, y, w, h) {
    var nwm=workspace.nwm;
    var client = x11.createClient(function(err, display) {
	if (!err) {
	    console.log("display");
	    console.log(display.screen[0].root);
	    var X = display.client;
	    var screen = display.screen[0];

	    var root = screen.root

	    var white = screen.white_pixel;
	    var black = screen.black_pixel;

	    var Exposure = x11.eventMask.Exposure;
	    var PointerMotion = x11.eventMask.PointerMotion;
	    var ButtonPress = x11.eventMask.ButtonPress;

	    // Create the window that will host UI Controls (close, l/r, ...)

	    var wid = X.AllocID();
	    console.log('Created wid: '+wid);
	    console.log('root: '+root);
	    console.log(screen);

	    X.CreateWindow(
		wid, root,        // new window id, parent
		x, y, w, h,   // x, y, w, h
		0, 0, 'myclass', 0,
		{ eventMask: Exposure|PointerMotion|ButtonPress}
	    );

	    var title = 'NWM Control Window';
	    X.ChangeProperty(display, wid, 
			     X.atoms.WM_NAME, X.atoms.STRING, 8, title);
	    X.MapWindow(wid);

	    var gc = X.AllocID();
	    X.CreateGC(gc, wid, {foreground: white, background: black});

	    var UI_CLOSE_WIDTH=20;
	    var UI_CLOSE_HEIGHT=20;
	    var close_x = w/2-(UI_CLOSE_WIDTH/2);
	    var close_y = 0;

	    X.on('event', function(ev) {
		console.log(ev);
		if (ev.type == 12)
		{
		    // console.log("MOVE");
		    // X.MoveWindow(display, wid, x, y);
		    var rects = [close_x, close_y, UI_CLOSE_WIDTH, UI_CLOSE_HEIGHT]; // xxx dbo
		    console.log("POLY");
		    X.PolyFillRectangle(wid, gc, rects);
		} else if (ev.type == 6 && ev.wid == wid) {
		    console.log("in window");
		} else if (ev.type == 4 && ev.wid == wid) {
		    if ((ev.rootx-x) >= close_x && 
			(ev.rootx-x) <= close_x+UI_CLOSE_WIDTH &&
			(ev.rooty-y) >= close_y && 
			(ev.rooty-y) <= close_y+UI_CLOSE_HEIGHT) {
			var mainId = workspace.mainWindow;
			console.log('closing current window');
			console.log(mainId)
			nwm.drag_window(workspace, -3*w/4, 0, true);
			nwm.wm.killWindow(mainId);
			
		    }
		}
	    });
	    X.on('error', function(e) {
		console.log(e);
	    });
	} else {
	    console.log(err);
	}

    });
}

function createCmdWindow(workspace, x, y, w, h) {
    var nwm=workspace.nwm;
    var client = x11.createClient(function(err, display) {
	if (!err) {
	    console.log("display");
	    console.log(display.screen[0].root);
	    var X = display.client;
	    var screen = display.screen[0];

	    var root = screen.root

	    var Exposure = x11.eventMask.Exposure;
	    var PointerMotion = x11.eventMask.PointerMotion;
	    var ButtonPress = x11.eventMask.ButtonPress;

	    // Create the window that will host the Command Window

	    var wid = X.AllocID();
	    console.log('Created CMD wid: '+wid+' '+w+'x'+h);
	    console.log('root: '+root);
	    console.log(screen);

	    X.CreateWindow(
		wid, root,        // new window id, parent
		x, y, w, h,   // x, y, w, h
		0, 0, 0, 0,
		{ /* eventMask: Exposure|PointerMotion|ButtonPress */ }
	    );

	    var title = nwm.CMD_TITLE;
	    nwm.cmd_window = wid;

	    X.ChangeProperty(display, wid, 
			     X.atoms.WM_NAME, X.atoms.STRING, 8, title);


	    X.MapWindow(wid);

	    var chwid= w/6
	    var geom= Math.floor(w/6)+'+0+0'
	    child_process.spawn('xterm', ['-into', wid, '-geometry', geom, '-lc'], 
				{ env: process.env });

	    X.on('event', function(ev) {
		console.log('CMD EVENT');
		console.log(ev);
		if (ev.type == 12)
		{
		} else if (ev.type == 6 && ev.wid == wid) {
		    console.log("in window");
		} else if (ev.type == 4 && ev.wid == wid) {
		}
	    });
	    X.on('error', function(e) {
		console.log(e);
	    });
	} else {
	    console.log(err);
	}

    });
}


var _firstlayout = true;

function lever(workspace){
    // "lever" layout -- one main work window with a command and control area beneath it

    var screen = workspace.monitor;
    var ctl_x = UI_MARGIN;
    var ctl_y = screen.height-UI_CTL_HEIGHT-UI_CMD_HEIGHT;
    var ctl_width = screen.width-2*UI_MARGIN;
    var ctl_height = UI_CTL_HEIGHT;

    var cmd_x = UI_MARGIN;
    var cmd_y = screen.height-UI_CMD_HEIGHT;
    var cmd_width = screen.width-2*UI_MARGIN;
    var cmd_height = UI_CMD_HEIGHT;


    // do setup as necessary
    workspace.nwm.drag_window = dragWindow;
    if (_firstlayout) {
	_firstlayout = false;
	createUiControls(workspace, ctl_x, ctl_y, ctl_width, ctl_height);
	createCmdWindow(workspace, cmd_x, cmd_y, cmd_width, cmd_height);
    }

    // make sure that the main window is visible, always!
    var mainId = workspace.mainWindow;
    console.log('REDRAW! '+mainId);

    if (!workspace.nwm.windows.exists(mainId)) {
	console.log("ID no longer exists");
	return;
    }

    // separate windows into visible/invisible workspaces, the always present
    // command and UI control windows
    var window_ids = get_window_ids(workspace);
    var visible = window_ids.visible;
    var hidden = window_ids.hidden;
    var cmdId = window_ids.cmdId;
    var ctlId = window_ids.ctlId

    console.log('cmd id: '+cmdId)

    // resize and make visible the main window (and subsequent if 2-up)

    // filter out visible windows
    console.log('visible: '+visible);
    console.log('hidden: '+hidden);

    // add margins and split up the space vertically
    var work_width = (screen.width-2*UI_MARGIN) / visible.length;
    var work_height = screen.height-2*UI_MARGIN-UI_CMD_HEIGHT-UI_CTL_HEIGHT;
    x = screen.x+UI_MARGIN;
    y = screen.y+UI_MARGIN;

    var windows = workspace.nwm.windows.items;
    // place and show the visible work windows
    visible.forEach(function(id, index) {
	var win = windows[id];
	win.move(x, y);
	win.resize(work_width, work_height);
	win.show();

	x += work_width;
    });
	

    // hide (and resize) any remaining work windows
    hidden.forEach(function(id, index) {
	var win = windows[id];
	win.hide();
	win.resize(work_width, work_height); // make sure you can assume the right width
    });

    // set up the ui control and command windows
    if (ctlId && ctlId in windows) {
	var win=windows[ctlId];
	win.move(ctl_x, ctl_y);
	win.resize(ctl_width, ctl_height);
	win.show();
    }

    if (cmdId && cmdId in windows) {
	var win=windows[cmdId];
	win.move(UI_MARGIN, screen.height-UI_CMD_HEIGHT);
	win.resize(screen.width-2*UI_MARGIN, UI_CMD_HEIGHT);
	win.show();
    }
}



if (typeof module != 'undefined') {
    module.exports = lever;
}
