var tcp = require('../../tcp');
var instance_skel = require('../../instance_skel');
var debug;
var log;

function instance(system, id, config) {
	var self = this;
	this.maxConditions = 30;
	this.choicesConditions = [];

	for (var i=1; i<= this.maxConditions; i++) {
		this.choicesConditions[i-1] = {
			type: 'checkbox',
			label: 'Condition '+i,
			id: i-1,
			default: false
		}
	}
	// super-constructor
	instance_skel.apply(this, arguments);

	self.actions(); // export actions

	return self;
}

instance.prototype.init = function() {
	var self = this;

	debug = self.debug;
	log = self.log;

	self.init_tcp();
};

instance.prototype.updateConfig = function(config) {
	var self = this;
	self.config = config;

	self.init_tcp();
};

instance.prototype.init_tcp = function() {
	var self = this;

	if (self.socket !== undefined) {
		self.socket.destroy();
		delete self.socket;
	}

	if (self.config.host) {
		var port = 3040;
		if (self.config.type === 'disp') {
			port = 3039;
		}

		self.socket = new tcp(self.config.host, port);

		self.socket.on('status_change', function (status, message) {
			self.status(status, message);
		});

		self.socket.on('error', function (err) {
			debug("Network error", err);
			self.log('error',"Network error: " + err.message);
		});

		self.socket.on('connect', function () {
			debug("Connected");
			if (self.config.type === 'disp') {
				self.socket.send('authenticate 1\r\n');
			}
		});

		self.socket.on('data', function (data) {});
	}
};

// Return config fields for web config
instance.prototype.config_fields = function () {
	var self = this;

	return [
		{
			type: 'textinput',
			id: 'host',
			label: 'Watchout Computer IP',
			width: 6,
			regex: self.REGEX_IP
		},{
			type: 'dropdown',
			label: 'Type',
			id: 'type',
			default: 'prod',
			choices: [
				{ id: 'prod', label: 'Production Computer' },
				{ id: 'disp', label: 'Display Cluster' }
			]
		}
	]
};

// When module gets deleted
instance.prototype.destroy = function() {
	var self = this;

	if (self.socket !== undefined) {
		self.socket.destroy();
		self.socket = undefined;
	}

	debug("destroy", self.id);
};

instance.prototype.actions = function(system) {
	var self = this;
	self.system.emit('instance_actions', self.id, {
		'run': {
			label: 'Run',
			options: [{
				type: 'textinput',
				label: 'timeline (optional)',
				id: 'timeline',
				default: ''
			}]},
		'halt': {
			 label: 'Pause',
			 options: [{
				 type: 'textinput',
				 label: 'timeline (optional)',
				 id: 'timeline',
				 default: ''
			}]},
		'kill': {
			label: 'Kill',
			options: [{
				type: 'textinput',
				label: 'Aux timeline',
				id: 'timeline',
				default: ''
			}]},
		'reset': {
			label: 'Reset'
			},
		'gototime': {
			label: 'Jump to time',
			options: [{
				type: 'textinput',
				label: 'time position',
				id: 'time',
				default: '"00:00:00.000"',
				regex: '/^(\\d{1,12}|"\\d{1,2}:\\d{1,2}:\\d{1,2}\\.\\d{1,3}")$/'
			},{
				type: 'textinput',
				label: 'timeline (optional)',
				id: 'timeline',
				default: ''
			}]},
		'gotocue': {
			label: 'Jump to cue',
			options: [{
				type: 'textinput',
				label: 'Cue name',
				id: 'cuename',
				default: ''
			},{
				type: 'textinput',
				label: 'timeline (optional)',
				id: 'timeline',
				default: ''
			}]},
		'online': { label: 'Go online',
			options: [{
				type: 'dropdown',
				label: 'go online',
				id: 'online',
				default: 'true',
				choices: self.CHOICES_YESNO_BOOLEAN
			}]},
		'standby': { label: 'Enter Standby',
			options: [{
				type: 'dropdown',
				label: 'Enter Standby',
				id: 'standby',
				default: 'true',
				choices: self.CHOICES_YESNO_BOOLEAN
			},{
				type: 'number',
				label: 'Fade time in ms',
				id: 'fadetime',
				min: 0,
				max: 60000,
				default: 1000,
				required: true
			}]},
		'setinput': {
			label: 'Set Input',
				options: [{
				type: 'textinput',
				label: 'Input Name',
				id: 'inputname',
				default: ''
			},{
				type: 'textinput',
				label: 'Value',
				id: 'inputvalue',
				default: '1.0',
				regex: self.REGEX_FLOAT
			},{
				type: 'textinput',
				label: 'Fadetime (ms)',
				id: 'inputfade',
				default: '0',
				regex: self.REGEX_NUMBER
				}]},
		'load': {
			label: 'Load Show',
			options: [{
				type: 'textinput',
				label: 'Showfile or Showname',
				id: 'show',
				default: '',
				regex: '/[a-zA-Z0-9\\\/:\.-_ ]+/'
			}]},
		'layerCond': {
			label: 'Set Layer Conditions',
			options: this.choicesConditions
		}

	});
};

instance.prototype.action = function(action) {
	var self = this;
	debug('run watchout action:', action);
	var cmd;

	switch (action.action) {
		case 'run':
			if (action.options.timeline != '')
				cmd = 'run "' + action.options.timeline + '"\r\n';
			else
				cmd = 'run\r\n';
			break;

		case 'halt':
			if (action.options.timeline != '')
				cmd = 'halt "' + action.options.timeline + '"\r\n';
			else
				cmd = 'halt\r\n';
			break;

		case 'kill':
			if (action.options.timeline != '')
				cmd = 'kill "' + action.options.timeline + '"\r\n';
			else {
				debug('Error: Kill command for Watchout production triggered without timeline name');
				self.log('error', 'Error: Kill command for Watchout production triggered without timeline name');
			}
			break;

		case 'reset':
				cmd = 'reset\r\n';
			break;

		case 'gototime':
			if (action.options.time != '') {
				cmd = 'gotoTime ' + action.options.time;
				if (action.options.timeline != '') cmd += ' "'+ action.options.timeline + '"';
				cmd += '\r\n';
			} else {
				debug('Error: Gototime command for Watchout production triggered without entering time');
				self.log('error', 'Error: Gototime command for Watchout production triggered without entering time');
			}
			break;

		case 'gotocue':
			if (action.options.cuename != '') {
				cmd = 'gotoControlCue "' + action.options.cuename +'" false';
				if (action.options.timeline != '') cmd += ' "'+ action.options.timeline +'"';
				cmd += '\r\n';
			} else {
				debug('Error: GotoControlCue command for Watchout production triggered without entering cue');
				self.log('error', 'Error: GotoControlCue command for Watchout production triggered without entering cue');
			}
			break;

		case 'online':
			if (action.options.online != 'false' && action.options.online != 'FALSE' && action.options.online != '0' )
				cmd = 'online true\r\n';
			else
				cmd = 'online false\r\n';
			break;

		case 'standby':
			if (action.options.fadetime === undefined || action.options.fadetime <0 || action.options.fadetime > 60000) {
				action.options.fadetime = 1000;
			}
			if (action.options.standby != 'false' && action.options.standby != 'FALSE' && action.options.standby != '0' )
				cmd = 'standBy true '+ action.options.fadetime.toString() +'\r\n';
			else
				cmd = 'standBy false '+ action.options.fadetime.toString() +'\r\n';
			break;

		case 'setinput':
			if (action.options.inputname != '' && action.options.inputvalue != '') {
				cmd = 'setInput "' + action.options.inputname +'" '+ parseFloat(action.options.inputvalue);
				if (action.options.inputfade != '') cmd += ' '+ parseInt(action.options.inputfade);
				cmd += '\r\n';
			} else {
				debug('Error: setInput command for Watchout production triggered without entering input name or input value');
				self.log('error', 'Error: setInput command for Watchout production triggered without entering input name or input value');
			}
			break;

		case 'load':
			if (action.options.show != '') {
				cmd = 'load "' + action.options.show +'"\r\n';
			}
			break;

		case 'layerCond':
			var cond = 0;
			for (var i=0; i< this.maxConditions; i++) {
				if (action.options[i] === true) {
					cond += 2**i;
				}
			}
			cmd = 'enableLayerCond ' + cond +'\r\n';
			break;
	}

	if (cmd !== undefined) {

		if (self.socket === undefined) {
			self.init_tcp();
		}

		debug('sending tcp',cmd,"to",self.config.host);

		if (self.socket !== undefined && self.socket.connected) {
			self.socket.send(cmd);
		} else {
			debug('Socket not connected :(');
		}

	}
};

instance_skel.extendedBy(instance);
exports = module.exports = instance;
