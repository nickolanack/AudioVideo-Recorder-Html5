var AudioRecorderModule=new Class({
	Implements:Module,

	process:function(){
		var me=this;
		var b=me.node.appendChild(new Element('span',{'class':me.options.className||"AudioRecorderContainer"}));
		
		var a=b.appendChild(new Element('span',{'class':me.options.className||"AudioRecorder"}));
		

		var audio =a.appendChild(new Element('audio', {}));
		var recorder=null;
		(recorder=new MicrophoneRecorder()).addEvent('onCreatedRecorder',function(){
			
			//audio.src=(window.URL || window.webkitURL).createObjectURL(recorder.getAudioStream());
			//audio.play();
			b.addClass('available');
			
			var record=null;
			var play=null;
			
			var recordIntervalTimer=null;
			var recordInterval=0.0;
			var recordEl=new Element('span',{'class':'record', data:'record audio'});
			
			(record=new UIButtonControl(a.appendChild(recordEl),{state:false})).addEvent('onChange', function(value){
				if(value){
					recorder.record();
					play.disable();
					download.disable();
					upload.disable();
					recordInterval=0.0;
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
					play.enable();
					download.enable();
					upload.enable();
					recordEl.setAttribute('data','record audio');
				}

			});
			
			
			(play=new UIButtonControl(a.appendChild(new Element('span',{'class':'play disabled'})),{state:false, enabled:false})).addEvent('onChange', function(value){
				if(value){
					var wav=recorder.getAudioBlob();
					var src=(window.URL || window.webkitURL).createObjectURL(wav);
					audio.src=src;
					audio.play();
					play._setState(false, true);
				}else{

				}

			});
			
			play.disable();
			
			(download=new UIButtonControl(a.appendChild(new Element('span',{'class':'download disabled'})),{state:false, enabled:false})).addEvent('onChange', function(value){
				if(value){
					AudioRecorder.Download(recorder.getAudioBlob(),'audio.wav');
					//only allow a single download per clip.
					download._setState(false, true);
					download.disable();
					play.disable();
				}else{
					
				}
			});
			
			(upload=new UIButtonControl(a.appendChild(new Element('span',{'class':'upload disabled'})),{state:false, enabled:false})).addEvent('onChange', function(value){
				if(value){
					AudioRecorder.Upload(recorder.getAudioBlob(),'audio.wav').addEvent('onSuccess',function(result){
						me.fireEvent('onUpload', result.audio);
					});
					//only allow a single upload per clip
					upload._setState(false, true);
					upload.disable();
					play.disable();
				}else{
					
				}
			});
			
		});
		

		
		



		me.fireEvent('onLoad');

	},

});




var AudioRecorder = new Class({
	Implements:Events,
	initialize:function(input, cfg){
		var me=this;
		me._initialize(input,cfg);
		
	},
	_initialize:function(input, cfg){
		var me=this;


		me.config = Object.append({
			
		},cfg);
		
		var bufferLen = me.config.bufferLen || 4096;
		var inputChannels = me.config.numInputChannels || 2;
		var outputChannels = me.config.numInputChannels || 2;
		
		var context = input.context;
		var script=null;
		if(!context.createScriptProcessor){
			script = context.createJavaScriptNode(bufferLen, inputChannels, outputChannels);
		}else{
			script = context.createScriptProcessor(bufferLen, inputChannels, outputChannels);
		}
		
		
		me.recLength = 0,
		me.recBuffersL = [],
		me.recBuffersR = [],
		me.sampleRate=context.sampleRate;

		

		me.recording = false,
		me.loopback=false;
		me.loopbackGain=1.0;
		
		script.onaudioprocess = function(e){
			if (!me.recording) return;
			
			var data=[
				         new Float32Array(e.inputBuffer.getChannelData(0)), //put channel data in new array or it will be a reference to the input buffers.
				         new Float32Array(e.inputBuffer.getChannelData(1))
				      ];
			
			me._store(data);
			
			
			
		};

		var l=context.createBiquadFilter();
		l.type = BiquadFilterNode.LOWPASS;
		l.frequency.value = 3400;
		
		var h=context.createBiquadFilter();		
		h.type = BiquadFilterNode.HIGHPASS;
		h.frequency.value = 300;
		
		
		input.connect(l);
		l.connect(h);
		h.connect(script);
		//node.connect(context.destination); //this does not get data through to destination
		var g=context.createGain(); //firefox and chrome
		g.gain.value=me.loopback?me.loopbackGain:0.0;
		
		
		me.loopbackGainNode=g; //node to control volume to speaker if looback.
		me.node=h; //node to give to caller if they want to process.
		
		
		
		h.connect(g);
		script.connect(context.destination);
		
		g.connect(context.destination);
		
		window.AudioNodes=[input, l, h, script, g, context.destination];
		
		me.fireEvent('onCreatedRecorder');
		//source.connect(context.destination);   // if the script node is not connected to an output the "onaudioprocess" event is not triggered in chrome.
	},


	record:function(){
		var me=this;
		me._clear();
		me.recording = true;
		me.fireEvent('onRecordStart');
	},

	stop:function(){
		var me=this;
		me.recording = false;
		me.fireEvent('onRecordStop');
	},
	clear:function(){
		var me=this;
		me._clear();
		me.fireEvent('onRecordClear');
	},
	
	

	getAudioBlob:function(options){
		var me=this;		
		return me._getAudioBlob(options);
	},

	getMonoAudioBlob:function(options){
		var me=this;
		return me._getMonoAudioBlob(options);
	},
	
	
	
	enableLoopback:function(){
		var me=this;
		me.loopback=true;
		me.loopbackGainNode.gain.value=me.loopbackGain;
	},
	disableLoopback:function(){
		var me=this;
		me.loopback=false;
		me.loopbackGainNode.gain.value=0.0;
	},
	setLoopbackGain:function(value){
		var me=this;
		me.loopbackGain=Math.max(0.0, Math.min(1.0,value));
		if(me.loopback){
			me.loopbackGainNode.gain.value=me.loopbackGain;
		}
	},
	getAudioNode:function(){
		var me=this;
		return me.node;
	},
	getAudioStream:function(){
		var me=this;
		var output=me.node.context.createMediaStreamDestination();
		me.node.connect(output);
		return output.stream;
	},
	


	_store:function(data){
		var me=this;
		me.recBuffersL.push(data[0]); //left
		me.recBuffersR.push(data[1]); //right
		me.recLength += data[0].length;
	},

	_getAudioBlob:function(options){
		var me=this;
		var bufferL = me._mergeBuffers(me.recBuffersL, me.recLength);
		var bufferR = me._mergeBuffers(me.recBuffersR, me.recLength);
		
		config=Object.append({type: 'audio/wav'}, options);
		
		
		var dataview = me._encodeWAV(bufferL, bufferR, config);
		var audioBlob = new Blob([dataview],{type: config.type});

		return audioBlob;
	},

	_getMonoAudioBlob:function(options){
		var me=this;
		var bufferL = me._mergeBuffers(me.recBuffersL, me.recLength);
		
		config=Object.append({type: 'audio/wav', mono:true}, options);
		
		var dataview = me._encodeWAV(bufferL, null, config);
		var audioBlob = new Blob([dataview], { type: config.type });

		return audioBlob;
	},

	_clear:function(){
		var me=this;
		me.recLength = 0;
		me.recBuffersL = [];
		me.recBuffersR = [];
	},

	_mergeBuffers:function(recBuffers, recLength){
		var result = new Float32Array(recLength);
		var offset = 0;
		for (var i = 0; i < recBuffers.length; i++){
			result.set(recBuffers[i], offset);
			offset += recBuffers[i].length;
		}
		return result;
	},

	_interleave:function(inputL, inputR){
		var length = inputL.length + inputR.length;
		var result = new Float32Array(length);

		var index = 0;
		var inputIndex = 0;

		while (index < length){
			result[index++] = inputL[inputIndex];
			result[index++] = inputR[inputIndex];
			inputIndex++;
		}
		return result;
	},

	_floatTo16BitPCM:function(output, offset, input){
		for (var i = 0; i < input.length; i++, offset+=2){
			var s = Math.max(-1, Math.min(1, input[i]));
			output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
		}
	},

	_writeString:function(view, offset, string){
		for (var i = 0; i < string.length; i++){
			view.setUint8(offset + i, string.charCodeAt(i));
		}
	},

	
	/**
	 * this does not affect the internal sample buffers. it takes (interleaved) samples array and reduces  
	 * it to match the new lower sample rate. by averaging consecutive samples within calculated (rounded) step offsets.
	 * 
	 * there seems to be an issue when resampling mono data
	 * 
	 * @param samples
	 * @param newSampleRate
	 * @returns Float32Array
	 */
	_resampleBuffer:function(samples, newSampleRate) {
		var me=this;
		var oldSampleRate=me.sampleRate;
		
	    if (newSampleRate == oldSampleRate) {
	        return samples;
	    }
	    if (newSampleRate > oldSampleRate) {
	        throw "sample rate must be lower than original sample rate";
	    }
	    var sampleRateRatio = oldSampleRate / newSampleRate;
	    var newLength = Math.round(samples.length / sampleRateRatio);
	    var result = new Float32Array(newLength);
	    var offsetResult = 0;
	    var offsetBuffer = 0;
	    while (offsetResult < result.length) {
	        var nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
	        var accum = 0, count = 0;
	        for (var i = offsetBuffer; i < nextOffsetBuffer && i < samples.length; i++) {
	            accum += samples[i];
	            count++;
	        }
	        result[offsetResult] = accum / count;
	        offsetResult++;
	        offsetBuffer = nextOffsetBuffer;
	    }
	    return result;
	},
	
	_encodeWAV:function(left, right, options){
		var me=this;
		
		var config=Object.append({
			mono:false,
			sampleRate:me.sampleRate
		},options);
		
		var samples=left;
		if(config.mono){
			if(!samples){
				samples=right;
			}
			
		}else{
			samples = me._interleave(left, right);
		}	
		
		if(config.sampleRate<me.sampleRate){
			
			samples=me._resampleBuffer(samples, config.sampleRate);
			
		}else{
			config.sampleRate=me.sampleRate; //can't upsample
		}
			
		var buffer = new ArrayBuffer(44 + samples.length * 2);
		var view = new DataView(buffer);
			

		/* RIFF identifier */
		me._writeString(view, 0, 'RIFF');
		/* file length */
		view.setUint32(4, 32 + samples.length * 2, true);
		/* RIFF type */
		me._writeString(view, 8, 'WAVE');
		/* format chunk identifier */
		me._writeString(view, 12, 'fmt ');
		/* format chunk length */
		view.setUint32(16, 16, true);
		/* sample format (raw) */
		view.setUint16(20, 1, true);
		/* channel count */
		view.setUint16(22, config.mono?1:2, true);
		/* sample rate */
		view.setUint32(24, config.sampleRate, true);
		/* byte rate (sample rate * block align) */
		view.setUint32(28, config.sampleRate * 4, true);
		/* block align (channel count * bytes per sample) */
		view.setUint16(32, 4, true);
		/* bits per sample */
		view.setUint16(34, 16, true);
		/* data chunk identifier */
		me._writeString(view, 36, 'data');
		/* data chunk length */
		view.setUint32(40, samples.length * 2, true);

		me._floatTo16BitPCM(view, 44, samples);

		return view;
	}	

});

AudioRecorder.Download = function(blob, filename){
	var url = (window.URL || window.webkitURL).createObjectURL(blob);
	var link = new Element('a');
	link.href = url;
	link.download = filename || 'output.wav';
	link.click();
};

AudioRecorder.Upload = function(blob, filename){
	return (new UploadWAVBlobQuery(blob)).addEvent('onSuccess',function(result){
		
		
		
	}).execute();
	
	
};

var UploadWAVBlobQuery=new Class({
	Extends:AjaxControlQuery,
	initialize:function(audio){
		var me=this;
		me.base64data=null;
		this.parent(GeoliveAjaxContentServer,'audio_upload', {type:audio.type, size:audio.size});
		var reader = new window.FileReader();
		reader.readAsDataURL(audio); 
		reader.onloadend = function() {
			var base64data = reader.result;                
			//console.log(base64data);
			me.base64data=base64data;
			if(me._execute)me.execute();
		};

	},
	execute:function(){
		var me=this;
		me._execute=true;
		if(me.base64data!=null)me.parent();
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

MicrophoneRecorder=new Class({
	Extends:AudioRecorder,
	initialize:function(options){
		var me=this;
		me.config={};
		 
		navigator.getUserMedia  = navigator.getUserMedia||navigator.webkitGetUserMedia||navigator.mozGetUserMedia||navigator.msGetUserMedia;
		window.AudioContext = window.AudioContext||window.webkitAudioContext;

		var context = new AudioContext();
		me.fireEvent('onMicrophoneRequestStart');
		navigator.getUserMedia({audio: true}, function(stream){
				
			var microphone = context.createMediaStreamSource(stream);
			me.fireEvent('onMicrophoneRequestAccepted');
			me._initialize(microphone, options);
			//window.audiorecorder=recorder;
		}, function(e){
			me.fireEvent('onMicrophoneRequestFailed');
			JSConsoleError(['AudioContext Error', e]);
			
		});

		
		
	}
	
});