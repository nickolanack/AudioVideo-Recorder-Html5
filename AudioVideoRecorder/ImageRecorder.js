/**
 * ImageRecorder, and CameraRecorder 
 * 
 * 
 * Example:
 * 
 * 		var recorder;
 * 		(recorder=new CameraRecorder()).addEvent('onCreatedRecorder',function(){
			
			var video=recorder.getVideoElement();
			//do something with video el... put it into the document...
			
			//make a button. 'take photo' button
			var button; 
			// ...
			// ...
			button.addEvent('click', function(value){
				
					//take a picture. retrieve as url
					var i=new Asset.image(recorder.getImageUrl('image/png'));
					//do something with image. put it in document. 
					
					// or get image blob
					
					var b=recorder.getImageBlob('image/png');
					//could upload to server
					
			});

				
				
		});			
 * 
 * 
 * 
 * 
 * 
 */


var ImageRecorder = new Class({
	Implements:Events,
	initialize:function(){},
	_initialize:function(stream){
		var me=this;
		me.stream=stream;
		me.video=new Element('video', {autoplay:true});
		me.video.src=(window.URL || window.webkitURL).createObjectURL(me.stream);
		me.fireEvent('onCreatedRecorder');
	},
	
	getVideoStream:function(){
		var me=this;
		return me.stream;
	},
	getVideoElement:function(){
		var me=this;
		return me.video;
	},
	getImageUrl:function(format, quality){
		var me=this;
		var canvas=new Element('canvas',{width:me.video.videoWidth, height:me.video.videoHeight});
		
		var ctx = canvas.getContext('2d');
		ctx.drawImage(me.video, 0, 0);
		ctx.scale(-1,1); //mirror on x. seems more natural
		if((['image/png', 'image/jpeg', 'image/webp']).indexOf(format)>=0){
			
			return canvas.toDataURL(format, (quality>0)?quality:1);

		}else{
			return canvas.toDataURL('image/png');
		}
		
		
	},
	getImageBlob:function(format, quality){
		
		var me=this;
		var url=me.getImageUrl(format, quality);
		var byteString = atob(url.split(',')[1]);

		// separate out the mime component
		var mimeString = url.split(',')[0].split(':')[1].split(';')[0];
		// write the bytes of the string to an ArrayBuffer
		var ab = new ArrayBuffer(byteString.length);
		var ia = new Uint8Array(ab);
		for (var i = 0; i < byteString.length; i++) {
			ia[i] = byteString.charCodeAt(i);
		}

		// write the ArrayBuffer to a blob, and you're done
		var blob=new Blob([ab],{type:mimeString});

		return blob;
	},
});



CameraRecorder=new Class({
	
	Extends:ImageRecorder,
	//options aren't used
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
