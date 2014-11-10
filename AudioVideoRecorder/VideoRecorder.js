var VideoRecorderModule=new Class({
	Implements:Module,

	process:function(){
		var me=this;
		var b=me.node.appendChild(new Element('span',{'class':me.options.className||"VideoRecorderContainer"}));
		
		var a=b.appendChild(new Element('span',{'class':me.options.className||"VideoRecorder"}));
		

		var video =a.appendChild(new Element('video', {autoplay:true}));
		var recorder=null;
		(recorder=new VideoCameraRecorder()).addEvent('onCreatedRecorder',function(){
			
			video.src=(window.URL || window.webkitURL).createObjectURL(recorder.getVideoStream());
			//audio.play();
			b.addClass('available');
			
			var record=null;
			var recordEl=new Element('span',{'class':'record', data:'record video'});

			
			var recordIntervalTimer=null;
			
			(record=new UIButtonControl(a.appendChild(recordEl),{state:false})).addEvent('onChange', function(value){
				
				if(value){
					b.removeClass('hasRecording');
					recorder.record(video);
					//play.disable();
					download.disable();
					upload.disable();
					var recordInterval=0.0;
					recordIntervalTimer=setInterval(function(){
						recordInterval+=0.1;
						var m=(Math.round(recordInterval/60)%60);
						if(m<10)m="0"+m;
						var s=Math.round((recordInterval%60.0)*10.0)/10.0;
						if(s%1==0)s+=".0";
						
						recordEl.setAttribute('data',"00:"+m+" "+s);
					},100);
				}else{
					recorder.stop();
					if(recordIntervalTimer){
						clearInterval(recordIntervalTimer);
						recordIntervalTimer=null;
					}
					//play.enable();
					download.enable();
					upload.enable();
					recordEl.setAttribute('data','record video');
				}

				
				
			});
			
			

			(download=new UIButtonControl(a.appendChild(new Element('span',{'class':'download disabled'})),{state:false, enabled:false})).addEvent('onChange', function(value){
				
			});
			
			(upload=new UIButtonControl(a.appendChild(new Element('span',{'class':'upload disabled'})),{state:false, enabled:false})).addEvent('onChange', function(value){
			
				var blob=recorder.getRecordingBlob();
				  
				  
				(new UploadVideoBlobQuery(blob, "video/mp4")).addEvent('onSuccess',function(result){
					me.fireEvent('onUpload', result.video);					
				}).execute();
				
				
			});
			
		}).addEvent('onRecordedVideo',function(){
			
			//means that there is a video available
			b.addClass('hasRecording');
			b.removeClass('exporting');
			
		}).addEvent('onExportingVideo',function(){
			
			//means that current video audio data is being processed
			b.addClass('exporting');
			
		});
		

		
		



		me.fireEvent('onLoad');

	},

});





var VideoRecorder = new Class({
	Implements:Events,
	initialize:function(){},
	_initialize:function(stream){
		var me=this;
		me.stream=stream;
		me.fireEvent('onCreatedRecorder');
	},
	getStream:function(){
		var me=this;
		return me.stream;
	},
	getVideoStream:function(){
		return this.getStream();
	},
	
	getRecordingBlob:function(){
		var me=this;
		if(me._recording)return me._recording;
		return false;
	},
	
	
	
	
	record:function(video){
		var me=this;
		
		//video recording should display a mirrored video without controls (or they would be weird if also mirrored)
		video.src=(window.URL || window.webkitURL).createObjectURL(me.getVideoStream());
		video.controls=false;
		video.autoplay=true;
		
		//set up video recording loop.
		var recordVideo=function() {
            
			
			
    	    me._wsVideo.send("begin captureimageframes -mime jpg");
    	 
    	    var framecount=0;
    	    me._record=setInterval(function(){
    	    	
    	    	var canvas=new Element('canvas',{width:video.videoWidth, height:video.videoHeight});
    	    	var ctx = canvas.getContext('2d');
    			ctx.drawImage(video, 0, 0);
    			ctx.scale(-1,1); //mirror on x. seems more natural
    			var url=canvas.toDataURL('image/jpeg', 0.3);
    			   			
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
    			framecount++;
    			me._wsVideo.send(blob);
    			
    			if(framecount>0&&framecount%10==0){
    				JSConsole('video recorder: queued frames ['+(framecount-10)+' ... '+framecount+']');
    			}
    			  
    	    	
    	    }, 100);
    	    
    	};
    	
    	//define method. to use with recordVideo below
    	var recordAudio=function(){
  			if(me._audioRecorder){
  				me._audioRecorder.record();
  			}
  		};
		
  		//make sure socket exists if not, configure. 
  		//this assumes that the socket created exists for multiple 'start record', 'stop record', and 'export' loops. 
		if(!me._wsVideo){
			
			me._wsVideo = new WebSocket("ws://"+window.location.hostname+":8080");
			
			
			me._wsVideo.onmessage=function(message){
		    	
		    	
		    	if(message.data instanceof Blob){
		    		
		    		//can assume that we are done recording and have requested the compiled data as a blob.
		    		
		    		var reader = new FileReader();
		    		me._recording=message.data;
		    			    		
                    reader.onloadend = function (evt) {
                        if (evt.target.readyState == FileReader.DONE) {
                            
                        	me.fireEvent('onRecordedVideo');
                            video.src = null;
                            video.controls='controls';
                            video.autoplay=false;
                            video.src = "data:video/mp4;base64,"+btoa(evt.target.result);
                            video.load();
                            
                        }
                    };
	                    
	                reader.readAsBinaryString(message.data);
		    	}else{
		    		JSConsole('video socket: '+message.data);
		    		if(!isNaN(message.data)){
		    			//record video sockets numeric response. this is a unique id that might be useful
			    		me._wsVideoId=message.data;
			    	}
		    		
		    		//any other response is ignored (well printed to console at lease)
		    	}
		    	
		    	
		    	
		    };
		
		    me._wsVideo.onopen = function(){
		    	//record streams for the first time (after opening sockets)
		    	JSConsole("Succesfully Connected Video WebSocket: "+"ws://"+window.location.hostname+":8080");
		    	recordVideo();
		    	recordAudio();
		    	
		    };
		    
		}else{
			//record streams (websocket already exists)
			recordVideo();
			recordAudio();
		}
		
		
		
		
//		//this section enabled dual socket stream. although since audio is sent after 
//		//video frames as .wav, it is unnecesary
//		if(!me._wsAudio){
//			
//			me._wsAudio = new WebSocket("ws://"+window.location.hostname+":8080");
//			
//			
//			me._wsAudio.onmessage=function(message){
//		    	JSConsole('audio socket: '+message.data);
//		    	if(!isNaN(message.data)){
//		    		me._wsAudioId=message.data;
//		    	}
//		    };
//		
//		    me._wsAudio.onopen = function(){
//		    	JSConsole("Succesfully Connected Audio WebSocket: "+"ws://"+window.location.hostname+":8080");
//		    	recordAudio();
//		    };
//		    
//		   
//		    
//		}else{
//			recordAudio();
//      }
	
		
	},
	stop:function(){
		var me=this;
		if(me._record){
			
			clearInterval(me._record);
			me._record=null;
						
			if(me._audioRecorder){
				
				me._audioRecorder.stop();
				//me._wsAudio.send('begin audioupload -mime wav');
				//me._wsAudio.send(me._audioRecorder.getAudioBlob({sampleRate:11025})); //probably 44100 t
				//me._wsAudio.send("end");
				//me._wsAudio.send("give audio to "+me._wsVideoId); // tell server that audio data should belong to client 0

				
			}
					
			if(me._wsVideo){
				
				me._wsVideo.send("end");
				if(me._audioRecorder){
					
					me._wsVideo.send('begin audioupload -mime wav');
					me._wsVideo.send(me._audioRecorder.getAudioBlob({sampleRate:11025})); //this is pretty low quality audio but I don't want uploading to take too long.
					me._wsVideo.send("end");
					
				}
				//me._wsVideo.send("accept audio from "+me._wsAudioId); // tell server to accept audio from client 1. they must coordinate.
				me.fireEvent('onExportingVideo');
				me._wsVideo.send("export mp4 -fps 10"); // will merge the audio from client if succesfully transfered. support for mp4, webm, and ogv
				
			}

		}

	}
	
	
	
	
});


VideoRecorder.Download = function(blob, filename){

};


var UploadVideoBlobQuery=new Class({
	Extends:AjaxControlQuery,
	initialize:function(video, mime){
		var me=this;
		me.base64data=null;
		this.parent(GeoliveAjaxContentServer,'video_upload', {type:mime||video.type, size:video.size});
		var reader = new window.FileReader();
		reader.readAsDataURL(video); 
		reader.onloadend = function() {
			var base64data = reader.result;                
			//console.log(base64data );
			me.base64data=base64data;
			if(me._execute)me.execute();
		};

	},
	execute:function(){
		var me=this;
		me._execute=true;
		if(me.base64data!=null){
			me._execute=false;
			me.parent();
		}
		return me;
	},
	_data:function(){
		var me=this;
		var file=encodeURIComponent(me.base64data);
		return Object.append({
			data:'type='+me.data.type+'&base64data='+file+'&size='+me.data.size
			});
	},
	
});


VideoCameraRecorder=new Class({
	Extends:VideoRecorder,
	initialize:function(options){
		var me=this;

		 
		navigator.getUserMedia  = navigator.getUserMedia||navigator.webkitGetUserMedia||navigator.mozGetUserMedia||navigator.msGetUserMedia;
		
		me.fireEvent('onCameraRequestStart');
		navigator.getUserMedia({video:{
		    mandatory: {
		        maxWidth:427,
		        maxHeight:240
		    	}
		    }, audio: true}, function(stream){
		    	
		    //clone av stream. one for audio recorder which is not going to be fed to speaker
		    //and the origional stream will have audio removed, and fed to video element 
		    var audio=stream.clone();
		    
		    audio.removeTrack(audio.getVideoTracks()[0]);	//audio only
		    stream.removeTrack(stream.getAudioTracks()[0]); //video only
		    					
		    //create audio context for stream, (required by AudioRecorder) allows recorder to do cool things
		    //like filter noise etc
		    window.AudioContext = window.AudioContext||window.webkitAudioContext;
		    var context = new AudioContext();
		    me._audioRecorder=new AudioRecorder(context.createMediaStreamSource(audio)); //AudioRecorder.js records audio samples to buffer and allows exporting to wav with downsampling (linear pcm, 16bit le, variable samplerate stereo/mono)
		    
			me._initialize(stream); 
			me.fireEvent('onCameraRequestAccepted');
		}, function(e){
			me.fireEvent('onCameraRequestFailed');
			JSConsoleError(['VideoContext Error', e]);
			
		});


	}
	
});
