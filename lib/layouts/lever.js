/**
 * lever (a.k.a. fullscreen, with mods)
 *
 *  +---------------------+ +---------------------+
 *  |                     | |                     |
 *  |                     | |                     |
 *  |                     | |                     |
 *  |                     | |                     |
 *  |                     | |                     |
 *  |                     | |                     |
 *  |                     | |                     |
 *  +---------------------+ +---------------------+
 *        2 windows               3 windows
 *
 *  +---------------------+ +---------------------+
 *  |                     | |                     |
 *  |                     | |                     |
 *  |                     | |                     |
 *  |                     | |                     |
 *  |                     | |                     |
 *  |                     | |                     |
 *  |                     | |                     |
 *  +---------------------+ +---------------------+
 *        4 windows               5 windows
 */

var MARGIN=10; // n-pixel margin around windows
var two_up = false; // 1-up or 2-up

function get_window_ids(workspace) {

    // the visible windows are the main window, plus one 
    // to the right if in 2-up mode
    var windows = workspace.nwm.windows.items;
    var window_ids = Object.keys(windows).sort();

    var mainId = workspace.mainWindow.toString();
    var mainWin = workspace.nwm.windows.get(mainId);

    var mainIdx = window_ids.indexOf(mainId);
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
    
    hidden = window_ids.filter(function(id) { return (visible.indexOf(id) == -1); });

    return {mainId: mainId, 
	    visible: visible, 
	    hidden: hidden, 
	    rightId: window_ids[rightIdx], 
	    leftId: window_ids[leftIdx]}
}

function onDrag(workspace, delta_x, delta_y, done) {


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
    var x = mainWin.x + delta_x;
    var width = mainWin.width;

    visible.forEach(function(id, index) {
	var win = windows[id];
	win.move(x, y);
	win.show();

	x += width;
    });

    var SWIPE_FPS=10
    function resetMainWindow(id, win) {
	// done animating -- reset the main window
	var screen = workspace.monitor;
	win.x = screen.x + MARGIN;
	win.show();
	workspace.mainWindow = id;
    }
    function swipeRight(delta, id, win) {
	if (delta <= 1) {
	    resetMainWindow(id, win)
	} else {
	    onDrag(workspace, delta, 0, false);
	    setTimeout(function() { swipeRight(delta /2, id, win)}, 100);
	}
    }
    function swipeLeft(delta, id, win) {
	if (delta >= -1) {
	    resetMainWindow(id, win);
	} else {
	    onDrag(workspace, delta, 0, false);
	    setTimeout(function() { swipeLeft(delta /2, id, win)}, 100);
	}
    }


    if ((mainWin.x + delta_x) > 0) {
	// dragging to the right
	var leftWin = workspace.nwm.windows.get(leftId);

	if (done) {
	    // if done dragging, either animate the new window into the main
	    // position or animate back to square one i fthe user doesn't seem serious
	    
	    if (mainWin.x >= (mainWin.width/8)) {
		// if we're more than 1/8 dragged over, assume we were serious
		var delta = (mainWin.width - mainWin.x) / 2 + 1;
		swipeRight(delta, leftId, leftWin);
	    } else {
		// half hearted... snap back
		var delta = mainWin.x / 2;
		swipeLeft(-delta, mainId, mainWin);
	    }

	    return;
	}

	// further reveal the window to the left
	leftWin.x = -(leftWin.width + MARGIN) + mainWin.x;
	leftWin.move(leftWin.x, mainWin.y);
	leftWin.show()
    } else {
	// dragging to the left
	var rightWin = workspace.nwm.windows.get(rightId);

	if (done) {
	    // if done dragging, either animate the new window into the main
	    // position or animate back to square one i fthe user doesn't seem serious

	    if (mainWin.x+mainWin.width < (7*mainWin.width/8)) {
		var delta = -(mainWin.x / 2);
		swipeLeft(delta, rightId, rightWin);
	    } else {
		// half hearted... snap back
		var delta = (mainWin.width-mainWin.x) / 2;
		swipeRight(delta, mainId, mainWin);
	    }

	    return;
	}

	rightWin.x = mainWin.x + (mainWin.width + MARGIN)*visible.length; // delta_x already added in
	rightWin.move(rightWin.x, mainWin.y);
	rightWin.show()
    }
}

function lever(workspace){
    var screen = workspace.monitor;

    // set up our onDrag function
    workspace.nwm.onDrag = onDrag;

    // make sure that the main window is visible, always!
    var mainId = workspace.mainWindow;
    console.log('REDRAW! '+mainId);
    if (!workspace.nwm.windows.exists(mainId)) {
	return;
    }

    var window_ids = get_window_ids(workspace);
    var visible = window_ids.visible;
    var hidden = window_ids.hidden;

    // resize and make visible the main window (and subsequent if 2-up)

    // filter out visible windows
    console.log('visible: '+visible);
    console.log('remaining: '+hidden);

    // add margins and split up the space vertically
    var width = (screen.width-2*MARGIN) / visible.length;
    var height = screen.height-2*MARGIN;
    x = screen.x+MARGIN;
    y = screen.y+MARGIN;

    var windows = workspace.nwm.windows.items;
    // place and show the visible windows
    visible.forEach(function(id, index) {
	var win = windows[id];
	win.move(x, y);
	win.resize(width, height);
	win.show();

	x += width;
    });
	

    // hide anyone remaining
    hidden.forEach(function(id, index) {
	var win = windows[id];
	win.hide();
	win.resize(width, height); // make sure you can assume the right width
    });
}

if (typeof module != 'undefined') {
    module.exports = lever;
}
