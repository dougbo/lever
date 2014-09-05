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

function lever(workspace){
    var windows = workspace.nwm.windows.items;
    var screen = workspace.monitor;
    // make sure that the main window is visible, always!
    var mainId = workspace.mainWindow;
    if (!workspace.nwm.windows.exists(mainId)) {
	return;
    }

    var mainWin = workspace.nwm.windows.get(mainId);
    var window_ids = Object.keys(windows);

    // resize and make visible the main window (and subsequent if 2-up)
    var visible = [];
    visible.push(mainId.toString())
    if (workspace.n_up == '2') {
	// figure out who's adjacent to mainWin
	var idx = window_ids.indexOf(mainId.toString());
	if (idx == window_ids.length-1) {
	    idx = 0;
	}
	visible.push(window_ids[idx]);
    }

    // filter out visible windows
    window_ids = window_ids.filter(function(id) { return (id in visible); });

    // add margins and split up the space vertically
    var width = (screen.width-2*MARGIN) / visible.length;
    var height = screen.height-2*MARGIN;
    x = screen.x+MARGIN;
    y = screen.y+MARGIN;

    // place the visible windows
    visible.forEach(function(id, index) {
	var win = windows[id];
	win.move(x, y);
	win.resize(width, height);
	win.show();

	x += width;
    });
	

    // hide anyone remaining
    if (window_ids.length < 1) {
	return;
    }

    window_ids.forEach(function(id, index) {
	windows[id].hide();
    });
}

if (typeof module != 'undefined') {
    module.exports = lever;
}
