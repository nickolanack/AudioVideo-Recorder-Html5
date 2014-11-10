var ImageRecorder = new Class({
	Implements:Events,
	initialize:function(){},
	_initialize:function(stream){
		var me=this;
		me.stream=stream;
		me.fireEvent('onCreatedRecorder');
	},
	getVideoStream:function(){
		var me=this;
		return me.stream;
	}
});



CameraRecorder=new Class({
	Extends:ImageRecorder,
	initialize:function(options){
		var me=this;
	
		 
		navigator.getUserMedia  = navigator.getUserMedia||navigator.webkitGetUserMedia||navigator.mozGetUserMedia||navigator.msGetUserMedia;
		
		
		me.fireEvent('onCameraRequestStart');
		navigator.getUserMedia({video:true/*, audio: true*/}, function(stream){
				
			//var microphone = context.createMediaStreamSource(stream);
			me._initialize(stream);
			me.fireEvent('onCameraRequestAccepted');
		}, function(e){
			me.fireEvent('onCameraRequestFailed');
			JSConsole(['VideoContext Error', e]);
			
		});

		
		
	}
	
});
