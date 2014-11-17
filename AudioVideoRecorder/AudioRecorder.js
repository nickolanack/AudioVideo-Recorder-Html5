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

	getAudioBlob:function(options){
		var me=this;
		var bufferL = me._mergeBuffers(me.recBuffersL, me.recLength);
		var bufferR = me._mergeBuffers(me.recBuffersR, me.recLength);
		
		config=Object.append({type: 'audio/wav'}, options);
		
		
		var dataview = me._encodeWAV(bufferL, bufferR, config);
		var audioBlob = new Blob([dataview],{type: config.type});

		return audioBlob;
	},

	getMonoAudioBlob:function(options){
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
			
		var ch=config.mono?1:2;
		var bitps=16;
		var byteps=(bitps/8)*ch;
		
		var buffer = new ArrayBuffer(44 + samples.length * ch);
		var view = new DataView(buffer);
		
		
		var _text=function(data, start, string){
			for(var i=0;i<string.length;i++){
				data.setUint8(start+i, string.charCodeAt(i));
			}
		};
			
		

		/* RIFF identifier */
		_text(view, 0, 'RIFF');
		/* file length */
		view.setUint32(4, 32 + samples.length * ch, true);
		/* RIFF type */
		_text(view, 8, 'WAVE');
		/* format chunk identifier */
		_text(view, 12, 'fmt ');
		/* format chunk length */
		view.setUint32(16, 16, true);
		/* sample format (raw) */
		view.setUint16(20, 1, true);
		/* channel count */
		view.setUint16(22, config.mono?1:2, true);
		/* sample rate */
		view.setUint32(24, config.sampleRate, true);
		/* byte rate (sample rate * block align) */
		view.setUint32(28, config.sampleRate * byteps, true);
		/* block align (channel count * bytes per sample) */
		view.setUint16(32, byteps, true);
		/* bits per sample */
		view.setUint16(34, 16, true);
		/* data chunk identifier */
		_text(view, 36, 'data');
		/* data chunk length */
		view.setUint32(40, samples.length * ch, true);

		var offset=44;
		for (var i = 0; i < samples.length; i++, offset+=2){
			var s = Math.max(-1, Math.min(1, samples[i]));
			try{
				view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
			}catch(e){
				console.log(e);
			}
		}
		

		return view;
	}	

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