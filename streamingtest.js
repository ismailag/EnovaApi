
var server = null;
if(window.location.protocol === 'http:')
	server = "http://" + window.location.hostname + ":8088/janus";
else
	server = "https://" + window.location.hostname + ":8089/janus";

var janus = null;
var streaming = null;

var spinner = null;

var selectedStream = gup('stream');


$(document).ready(function() { 
	// Initialize the library (all console debuggers enabled)
	if (selectedStream==2)
	{
	window.RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection; 
    var pc = new RTCPeerConnection({iceServers:[]}), noop = function(){};      
    pc.createDataChannel("");    
    pc.createOffer(pc.setLocalDescription.bind(pc), noop);    // create offer and set local description
    pc.onicecandidate =function (ice){  //listen for candidate events
        if(!ice || !ice.candidate || !ice.candidate.candidate)  return;
        myIP = /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/.exec(ice.candidate.candidate)[1];
 	
 $('#stream').append('<img src="http://'+myIP+':8181/stream?topic=/thermal_camera/image_colored" height="416" width="312" class="rounded centered "> ');
        pc.onicecandidate = noop;
    };


		
		return ;
	}
	Janus.init({debug: "all", callback: function() {
		// Use a button to start the demo
		
			
			started = true;
			$(this).attr('disabled', true).unbind('click');
			// Make sure the browser supports WebRTC
			if(!Janus.isWebrtcSupported()) {
				bootbox.alert("No WebRTC support... ");
				return;
			}
			// Create session
			janus = new Janus(
				{
					server: server,
					success: function() {
						// Attach to streaming plugin
						janus.attach(
							{
								plugin: "janus.plugin.streaming",
								success: function(pluginHandle) {
									$('#details').remove();
									streaming = pluginHandle;
									Janus.log("Plugin attached! (" + streaming.getPlugin() + ", id=" + streaming.getId() + ")");
									// Setup streaming session
									$('#update-streams').click(updateStreamsList);
									updateStreamsList();
									
								},
								error: function(error) {
									Janus.error("  -- Error attaching plugin... ", error);
									bootbox.alert("Error attaching plugin... " + error);
								},
								onmessage: function(msg, jsep) {
									Janus.debug(" ::: Got a message :::");
									Janus.debug(JSON.stringify(msg));
									var result = msg["result"];
									if(result !== null && result !== undefined) {
										if(result["status"] !== undefined && result["status"] !== null) {
											var status = result["status"];
											if(status === 'starting')
												$('#status').removeClass('hide').text("Starting, please wait...").show();
											else if(status === 'started')
												$('#status').removeClass('hide').text("Started").show();
											else if(status === 'stopped')
												stopStream();
										}
									} else if(msg["error"] !== undefined && msg["error"] !== null) {
										bootbox.alert(msg["error"]);
										stopStream();
										return;
									}
									if(jsep !== undefined && jsep !== null) {
										Janus.debug("Handling SDP as well...");
										Janus.debug(jsep);
										// Answer
										streaming.createAnswer(
											{
												jsep: jsep,
												media: { audioSend: false, videoSend: false },	// We want recvonly audio/video
												success: function(jsep) {
													Janus.debug("Got SDP!");
													Janus.debug(jsep);
													var body = { "request": "start" };
													streaming.send({"message": body, "jsep": jsep});
													$('#watch').html("Stop").removeAttr('disabled').click(stopStream);
												},
												error: function(error) {
													Janus.error("WebRTC error:", error);
													bootbox.alert("WebRTC error... " + JSON.stringify(error));
												}
											});
									}
								},
								onremotestream: function(stream) {
									if (selectedStream==2) {return;}
									Janus.debug(" ::: Got a remote stream :::");
									Janus.debug(JSON.stringify(stream));
									if($('#remotevideo').length === 0)
									$('#stream').append('<video class="rounded centered hide" id="remotevideo" width=640 height=480 autoplay/>');
									//$('#stream').append('<video class="rounded centered hide" id="remotevideo" style="display: inline; height: 100%; width:100%" autoplay/>');
									
									// Show the streaand hide the spinner when we get a playing event
									$("#remotevideo").bind("playing", function () {
										$('#waitingvideo').remove();
										$('#remotevideo').removeClass('hide');
										if(spinner !== null && spinner !== undefined)
											spinner.stop();
										spinner = null;
									});
									attachMediaStream($('#remotevideo').get(0), stream);
								},
								oncleanup: function() {
									Janus.log(" ::: Got a cleanup notification :::");
									$('#waitingvideo').remove();
									$('#remotevideo').remove();
								}
							});
					},
					error: function(error) {
						Janus.error(error);
						bootbox.alert(error, function() {
							window.location.reload();
						});
					},
					destroyed: function() {
						window.location.reload();
					}
			});
		
	}});
});

function updateStreamsList() {
	if (selectedStream==2) {return;}
	var body = { "request": "list" };
	Janus.debug("Sending message (" + JSON.stringify(body) + ")");
	streaming.send({"message": body, success: function(result) {
		
		if(result === null || result === undefined) {
			bootbox.alert("Got no response to our query for available streams");
			return;
		}
		if(result["list"] !== undefined && result["list"] !== null) {
			$('#streams').removeClass('hide').show();
			$('#streamslist').empty();
			$('#watch').attr('disabled', true).unbind('click');
			var list = result["list"];
			Janus.log("Got a list of available streams");
			Janus.debug(list);
			for(var mp in list) {
				Janus.debug("  >> [" + list[mp]["id"] + "] " + list[mp]["description"] + " (" + list[mp]["type"] + ")");
				$('#streamslist').append("<li><a href='#' id='" + list[mp]["id"] + "'>" + list[mp]["description"] + " (" + list[mp]["type"] + ")" + "</a></li>");
			}
					startStream();
		}
	}});
}

function startStream() {if (selectedStream==2) {return;}
	Janus.log("Selected video id #" + selectedStream);
	if(selectedStream === undefined || selectedStream === null) {
		bootbox.alert("Select a stream from the list");
		return;
	}
	
	var body = { "request": "watch", id: parseInt(selectedStream) };
	streaming.send({"message": body});
	// No remote video yet
	$('#stream').append('<video class="rounded centered" id="waitingvideo" width=320 height=240 />');
	if(spinner == null) {
		var target = document.getElementById('stream');
		spinner = new Spinner({top:100}).spin(target);
	} else {
		spinner.spin();
	}
}
function gup( name )
{
  name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
  var regexS = "[\\?&]"+name+"=([^&#]*)";
  var regex = new RegExp( regexS );
  var results = regex.exec( window.location.href );
  if( results == null )
    return "";
  else
    return results[1];
}
function stopStream() {
	$('#watch').attr('disabled', true).unbind('click');
	var body = { "request": "stop" };
	streaming.send({"message": body});
	streaming.hangup();
	$('#streamset').removeAttr('disabled');
	$('#streamslist').removeAttr('disabled');
	$('#watch').html("Watch or Listen").removeAttr('disabled').click(startStream);
	$('#status').empty().hide();
}
