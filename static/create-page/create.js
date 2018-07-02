// anonymous wrapper
(function() {

var canvas;
var ctx;
var importPanel;
var timelineCanvas;
var timelineCtx;

function main() {
    initCanvas();
    initImportPanel();
    Display.init();
    Timeline.init();
    GifGenerator.init();
    window.addEventListener("resize", function() {
        Timeline.resize();
    }, true);
}

function initCanvas() {
    canvas = document.getElementById("canvas");
    ctx = canvas.getContext("2d");

    // sets the resolution as opposed to the screen space used
    canvas.setAttribute("width", "1366px");
    canvas.setAttribute("height", "768px");

    // time canvas and context
    timelineCanvas = document.getElementById("timeline");
    timelineCtx = timelineCanvas.getContext("2d");
    timelineCanvas.setAttribute("width", timelineCanvas.clientWidth);
    timelineCanvas.setAttribute("height", timelineCanvas.clientHeight);
}

function initImportPanel() {
    importPanel = document.getElementById("import-panel");
}

var Importer = (function() {
    var videos = [];

    function importVideo() {
        var fileSelector = document.createElement("input");
        fileSelector.setAttribute("type", "file");
        fileSelector.click();

        // whenever a file is selected ...
        fileSelector.onchange = function() {
            if(fileSelector.files && fileSelector.files[0] && !document.getElementById(fileSelector.value)) {
                var reader = new FileReader();

                // create an empty video element
                var video = document.createElement("video");
                video.classList.add("video-preview");

                // create a video substitute during loading
                var loadDiv = document.createElement("div");
                loadDiv.classList.add("video-loading");
                document.getElementById("import-panel").insertBefore(loadDiv, document.getElementById("import-panel").lastChild.nextSibling);

                // add a progress bar over the video element to show the progress of loading
                var progressBar = document.createElement("progress");
                progressBar.classList.add("center-center");
                progressBar.max = 1;
                progressBar.value = 0;
                loadDiv.appendChild(progressBar);

                // update the progress bar as the file is loaded
                reader.onprogress = function(e) {
                    if(e.lengthComputable) {
                        progressBar.max = e.total;
                        progressBar.value = e.loaded;
                    }
                }

                // load the video from local storage into browser memory
                reader.onloadend = function(e) {
                    if(e.target.error) {
                        video.classList.remove("video-loading");
                        video.classList.add("video-error");
                    } else {
                        video.src = e.target.result;
                    }
                }

                // if the video errors, display an error message
                // TODO - ensure this is correct event and is fired correctly
                video.onerror = function() {
                    progressBar.remove();
                    loadDiv.classList.remove("video-loading");
                    loadDiv.classList.add("video-error");

                    var errorMsg = document.createElement("label");
                    errorMsg.innerHTML = "Error";
                    errorMsg.classList.add("text-center-center");
                    loadDiv.appendChild(errorMsg);
                }

                // load the video from browser memory into an html5 video element
                video.onloadeddata = function() {
                    loadDiv.remove();
                    video.setAttribute("id", fileSelector.value);
                    video.setAttribute("draggable", true);
                    video.ondragstart = drag;
                    document.getElementById("import-panel").insertBefore(video, document.getElementById("import-panel").lastChild.nextSibling);
                    videos.push(video);
                }

                reader.readAsDataURL(fileSelector.files[0]);
            }
        };
    }

    function drag(ev) {
        ev.dataTransfer.setData("text", ev.target.id);
    }

    function dragEnd(ev) {

    }

    document.getElementById("import-button").onclick = importVideo;

    return { videos };
})();

var Display = (function() {
    var showPauseButton = false;
    var playing = false;

    function init() {
        canvas.onmouseover = onMouseOver;
        canvas.onmouseleave = onMouseLeave;
        canvas.onclick = onMouseClick;
    }

    function play(encoder) {
        playing = true;
        var time = encoder ? 0 : Timeline.getCurrentTime();
        var segment, video;
        var currentSegment;

        // calculate the total duration of all clips
        var totalDuration = 0;
        var totalDurationSoFar = 0;
        for(var segmentIndex in Timeline.segments) {
            var segment_ =  Timeline.segments[segmentIndex];
            totalDuration += segment_.endTime - segment_.startTime;
            var length = segment_.endTime - segment_.startTime;
            var totalDurationNow = length + totalDurationSoFar;
            // if true, the time falls under this segment
            if(time <= totalDurationNow && !segment) {
                // calculate the correct segment time
                var segmentTime = time - totalDurationSoFar;
                segment = segment_;
                video = segment_.video;
                video.currentTime = segment_.startTime + segmentTime;
                currentSegment = segmentIndex;
            }
        }

        if(video) {
            var frames = [];

            var recorderCallback;
            if(encoder) {
                // record the newly created video track
                recorderCallback = record(encoder, frames);
                document.getElementById("progress-lbl").innerHTML = "Recording";
                document.getElementById("progress-bar").value = 0;
                document.getElementById("progress-bar").max = Math.floor(totalDuration);
                video.currentTime = segment.startTime;
            }

            // with help from stack overflow
            // https://stackoverflow.com/questions/4429440/html5-display-video-inside-canvas
            var scale = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
            var left = canvas.width / 2 - (video.videoWidth / 2) * scale;
            var top = canvas.height / 2 - (video.videoHeight / 2) * scale;
            video.play();

            // the time accumulated from finished clips
            var accumulatedTime = 0;

            (function loop() {
                // if the video has ended or the segment has surpassed its duration
                if(video.ended || segment.endTime <= video.currentTime) {
                    // end the previous video
                    video.pause();
                    // try to get the next video
                    currentSegment ++;
                    if(Timeline.segments.length > currentSegment) {
                        accumulatedTime += segment.endTime - segment.startTime;
                        segment = Timeline.segments[currentSegment];
                        video = segment.video;
                        // with help from stack overflow
                        // https://stackoverflow.com/questions/4429440/html5-display-video-inside-canvas
                        scale = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
                        left = canvas.width / 2 - (video.videoWidth / 2) * scale;
                        top = canvas.height / 2 - (video.videoHeight / 2) * scale;
                        video.currentTime = segment.startTime;
                        video.play();
                    } else {
                        if(encoder) {
                            // notify recorder that recording has finished
                            recorderCallback(false, true);
                            // encode the set of frames recorded to create a gif image
                            GifGenerator.encode(encoder, frames);
                        } else {
                            // set the current time back to the start
                            Timeline.setCurrentTime(0);
                            playing = false;
                            showPauseButton = false;
                            drawFrame(Timeline.getCurrentTime());
                            drawPlayButton();
                        }
                    }
                }

                if(playing && !video.paused) {
                    // render the video frame
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(video, left, top, video.videoWidth * scale, video.videoHeight * scale);

                    if(encoder) {
                        recorderCallback(true, false);
                    }

                    // if the user is mousing over the video, display a pause button over the frame
                    if(showPauseButton) {
                        drawPauseButton();
                    }

                    // set the current time of the timeline so the marker updates
                    Timeline.setCurrentTime(accumulatedTime + video.currentTime - segment.startTime);

                    // wait until next render frame
                    requestAnimationFrame(loop);
                }
            })();
        }
    }

    function drawFrame(time) {
        var totalDurationSoFar = 0;

        // determine which segment the time falls under
        for(var segment of Timeline.segments) {
            var length = segment.endTime - segment.startTime;
            var totalDurationNow = length + totalDurationSoFar;

            // if true, the time falls under this segment
            if(time < totalDurationNow) {
                // calculate the correct segment time
                var segmentTime = time - totalDurationSoFar;
                var video = segment.video;
                video.currentTime = segment.startTime + segmentTime;

                // with help from stack overflow
                // https://stackoverflow.com/questions/4429440/html5-display-video-inside-canvas
                var scale = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
                var left = canvas.width / 2 - (video.videoWidth / 2) * scale;
                var top = canvas.height / 2 - (video.videoHeight / 2) * scale;

                // render the video frame
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(video, left, top, video.videoWidth * scale, video.videoHeight * scale);
                break;
            }
        }
    }

    function record(encoder, frames, videoWidth, videoHeight) {

        // sets the resolution as opposed to the screen space used
        canvas.setAttribute("width", "400px");
        canvas.setAttribute("height", "225px");
        encoder.setQuality(20);

        var finishedRecording;
        var startedRecording;
        frames.length = 0;
        var recordingStartTime = performance.now();

        function loop() {
            var startTime = performance.now();
            frames.push(ctx.getImageData(0, 0, canvas.width, canvas.height));

            document.getElementById("progress-bar").value = Math.floor((performance.now() - recordingStartTime) / 1000);

            // set the timeout to give 20fps
            var timeElapsed = performance.now() - startTime;
            if(!finishedRecording) {
                setTimeout(loop, 50 - timeElapsed);
            }
        }

        // return a callback to be called when video has ended
        return function(startedRecording_, finishedRecording_) {
            finishedRecording = finishedRecording_;

            if(startedRecording_ && !startedRecording) {
                startedRecording = startedRecording_;
                loop();
            }

            if(finishedRecording) {
                // sets the resolution as opposed to the screen space used
                canvas.setAttribute("width", "1366px");
                canvas.setAttribute("height", "768px");
            }
        }
    }

    function pause() {
        for(var segment of Timeline.segments) {
            if(segment.video) {
                segment.video.pause();
            }
        }
    }

    function drawPlayButton() {
        ctx.fillStyle = "#eef";
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        var div = canvas.width/8;
        ctx.moveTo(canvas.width/2 + div, canvas.height/2);
        ctx.lineTo(canvas.width/2 - div, canvas.height/2 + div);
        ctx.lineTo(canvas.width/2 - div, canvas.height/2 - div);
        ctx.fill();
    }

    function drawPauseButton() {
        ctx.fillStyle = "#eef";
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        var div = canvas.width/16;
        ctx.rect(canvas.width/2 - div*2, canvas.height/2 - div*2, div, div*4);
        ctx.rect(canvas.width/2 + div, canvas.height/2 - div*2, div, div*4);
        ctx.fill();
    }

    function onMouseClick() {
        // only called on left click
        if(Timeline.segments.length > 0) {
            if(playing) {
                playing = false;
                showPauseButton = false;
                pause();
                drawFrame(Timeline.getCurrentTime());
                drawPlayButton();
            } else {
                playing = true;
                showPauseButton = true;
                drawPauseButton();
                play();
            }
        }
    }

    function onMouseOver() {
        if(playing) {
            showPauseButton = true;
        } else {
            drawPlayButton();
        }
    }

    function onMouseLeave() {
        showPauseButton = false;
    }

    return { init, play, pause, drawFrame };
})();

var Timeline = (function() {
    // references to imported videos with extra data for start time and duration
    var segments = [];

    // the time at which the frame being displayed occurs
    var currentTime = 0;

    // update variables
    var mouseDownLastUpdate = false;
    var draggingLeftEdge = false;
    var draggingRightEdge = false;
    var segmentBeingEdited = null;
    var draggingTimeMarker = false;
    var drawFrameCooldown = 0;

    // mouse co-ordinates on last update
    var prevMousex = 0, prevMousey = 0;

    function init() {
        timelineCanvas.ondragover = allowDrop;
        timelineCanvas.ondrop = drop;
        timelineCanvas.onmousemove = mouseMove;
        timelineCanvas.onmousedown = mouseDown;
        timelineCanvas.onmouseup = mouseUp;
        timelineCanvas.onmouseleave = mouseLeave;
        refresh();
    }

    function updateClip(mousex, mousey, mousedown, edge1x, edge2x, edgeLength, edgey, edgeHeight, currentSegment, cumulativeDuration) {
        if(!mousedown) {
            draggingLeftEdge = false;
            draggingRightEdge = false;
            segmentBeingEdited = null;
            return 0;
        }

        var returnVal = 0;

        // if the user is dragging the left edge...
        if(((mousex > edge1x && mousex < edge1x + edgeLength && mousey > edgey && mousey < edgey + edgeHeight) ||
                draggingLeftEdge) && (!segmentBeingEdited || currentSegment === segmentBeingEdited)) {
            draggingLeftEdge = true;
            segmentBeingEdited = currentSegment;
            returnVal = 1;
        }
        // else, if the user is dragging the right edge...
        else if(((mousex > edge2x && mousex < edge2x + edgeLength && mousey > edgey && mousey < edgey + edgeHeight) ||
                draggingRightEdge) && (!segmentBeingEdited || currentSegment === segmentBeingEdited)) {
            draggingRightEdge = true;
            segmentBeingEdited = currentSegment;
            returnVal = 2;
        }

        // calculate the amount the mouse has moved in the x-axis since last update
        var dx = mousex - prevMousex;

        // if dragging the left edge, update the start time based on direction moved
        if(draggingLeftEdge && segmentBeingEdited === currentSegment) {
            var ratio = dx / edgeLength * 10;   // calculate ratio of movement to full rect length
            segmentBeingEdited.startTime += dx * segmentBeingEdited.video.duration / 1000;
            segmentBeingEdited.startTime = segmentBeingEdited.startTime < 0 ? 0
                                            : segmentBeingEdited.startTime > segmentBeingEdited.endTime
                                            ? segmentBeingEdited.endTime : segmentBeingEdited.startTime;
            currentTime = cumulativeDuration;
        }

        // if dragging the right edge, update the end time based on direction moved
        if(draggingRightEdge && segmentBeingEdited === currentSegment) {
            var ratio = dx / edgeLength * 10;   // calculate ratio of movement to full rect length
            segmentBeingEdited.endTime -= dx * segmentBeingEdited.video.duration / 1000;
            segmentBeingEdited.endTime = segmentBeingEdited.endTime < segmentBeingEdited.startTime ? segmentBeingEdited.startTime
                                            : segmentBeingEdited.endTime > segmentBeingEdited.video.duration
                                            ? segmentBeingEdited.video.duration : segmentBeingEdited.endTime;
            currentTime = cumulativeDuration + segmentBeingEdited.endTime - segmentBeingEdited.startTime - 0.01;
        }

        return returnVal;
    }

    function refresh(mousex, mousey, mousedown) {
        // clear the timeline of all graphics
        timelineCtx.clearRect(0, 0, timelineCanvas.width, timelineCanvas.height);

        // calculate the total duration of all clips
        var totalDuration = 0;
        for(var segment of segments) {
            totalDuration += segment.endTime - segment.startTime;
        }

        var colors = [ "#bbb", "#999" ];
        var hoverColor = "#77bbff";
        var activeColor = "#77ffbb";

        var offsetX = initialOffsetX = 50;

        // calculate position and dimensions of the time marker
        var timeMarkerX = initialOffsetX + currentTime / totalDuration * (timelineCanvas.width - initialOffsetX*2);
        var timeMarkerY = timelineCanvas.height/4;
        var timeMarkerWidth = 2;
        var timeMarkerHeight = timelineCanvas.height/2;
        var hoveringTimeMarker = false;

        // determine whether the time marker is selected
        if(mousex > timeMarkerX-timeMarkerWidth && mousex < timeMarkerX+timeMarkerWidth*3 &&
                mousey > timeMarkerY && mousey < timeMarkerY + timeMarkerHeight && !draggingLeftEdge && !draggingRightEdge) {
            hoveringTimeMarker = true;

            if(mousedown) {
                draggingTimeMarker = true;
            }
        } else {
            hoveringTimeMarker = false;
        }

        if(!mousedown) {
            draggingTimeMarker = false;
        }

        if(draggingTimeMarker) {
            // move the marker to the current mouse position...
            // ...so long as it remains within bounds of timeline
            currentTime = (mousex - initialOffsetX) * totalDuration / (timelineCanvas.width - initialOffsetX*2);
            currentTime = currentTime > totalDuration ? totalDuration : currentTime < 0 ? 0 : currentTime;
        }

        var cumulativeDuration = 0;

        // update and draw each segment's rectangle(s)
        for(var segmentIndex in segments) {
            var segment = segments[segmentIndex];
            var imgHeight = timelineCanvas.height * 0.5;
            //var imgWidth = Math.floor(imgHeight * 16 / 9);
            var imgWidth = 200;
            var rectLength = Math.floor((segment.endTime - segment.startTime) / totalDuration * (timelineCanvas.width - initialOffsetX*2));

            // calculate the co-ordinates and dimensions of the rectangle
            var y = timelineCanvas.height/2-imgHeight/4;
            var height = imgHeight/2;

            // determine position of edge rectangles
            var edge1x = offsetX;
            var edge2x = offsetX + (rectLength * 0.9);
            var edgeLength = rectLength * 0.1;

            // determine whether one of the segments edges is being updated
            var updating = 0;
            if(!hoveringTimeMarker && !draggingTimeMarker) {
                updating = updateClip(mousex, mousey, mousedown, edge1x, edge2x, edgeLength, y, height, segment, cumulativeDuration);
                timeMarkerX = initialOffsetX + currentTime / totalDuration * (timelineCanvas.width - initialOffsetX*2);
                console.log(currentTime, timeMarkerX);
            }

            cumulativeDuration += segment.endTime - segment.startTime;

            // only draw 3 rectangle if the user isn't hovering/dragging the time marker, etc...
            if((!hoveringTimeMarker && !draggingTimeMarker) && (updating > 0 ||
                (mousex > offsetX && mousex < offsetX + rectLength && mousey > y && mousey < y + height))) {

                // draw 3 rectangle, 2 indicating the edges which can be pressed
                middleColor = colors[segmentIndex % colors.length];

                // draw the middle rectangle
                timelineCtx.fillStyle = middleColor;
                timelineCtx.fillRect(offsetX + edgeLength, y, rectLength * 0.8, height);

                // draw the edge rectangles
                timelineCtx.fillStyle = updating === 1 ? activeColor : hoverColor;
                timelineCtx.fillRect(edge1x, y, edgeLength, height);
                timelineCtx.fillStyle = updating === 2 ? activeColor : hoverColor;
                timelineCtx.fillRect(edge2x, y, edgeLength, height);
            } else {
                // draw one continuous rectangle for the clip
                timelineCtx.fillStyle = colors[segmentIndex % colors.length];
                timelineCtx.fillRect(offsetX, y, rectLength, height);
            }

            offsetX += rectLength;
        }

        // draw the current point indicator line
        timelineCtx.fillStyle = draggingTimeMarker ? activeColor : hoveringTimeMarker ? hoverColor : "#fff";
        timelineCtx.fillRect(timeMarkerX, timeMarkerY, timeMarkerWidth, timeMarkerHeight);

        if((draggingTimeMarker || draggingLeftEdge || draggingRightEdge) && drawFrameCooldown === 0) {
            Display.drawFrame(currentTime);
            drawFrameCooldown = 10;
        }

        // having a cooldown stops flickering
        if(drawFrameCooldown > 0) {
            drawFrameCooldown --;
        }
    }

    function getCurrentTime() {
        return currentTime;
    }

    function setCurrentTime(newTime) {
        if(typeof newTime === "number") {
            currentTime = newTime;
            refresh();
        }
    }

    function allowDrop(ev) {
        ev.preventDefault();
    }

    function drop(ev) {
        ev.preventDefault();
        var data = ev.dataTransfer.getData("text");
        var video = document.getElementById(data);

        // create a new segment for the received video
        segments.push({
            video: video,
            startTime: 0,
            endTime: video.duration
        });

        refresh();
    }

    function mouseMove(e) {
        //console.log(e.pageX - this.offsetLeft, e.pageY - this.offsetTop);
        refresh(e.pageX - this.offsetLeft, e.pageY - this.offsetTop, mouseDownLastUpdate);
        prevMousex = e.pageX - this.offsetLeft;
        prevMousey = e.pageY - this.offsetTop;
    }

    function mouseDown(e) {
        //console.log(e.pageX - this.offsetLeft, e.pageY - this.offsetTop);
        refresh(e.pageX - this.offsetLeft, e.pageY - this.offsetTop, true);
        mouseDownLastUpdate = true;
        prevMousex = e.pageX - this.offsetLeft;
        prevMousey = e.pageY - this.offsetTop;
    }

    function mouseUp(e) {
        refresh(e.pageX - this.offsetLeft, e.pageY - this.offsetTop);
        mouseDownLastUpdate = false;
        prevMousex = e.pageX - this.offsetLeft;
        prevMousey = e.pageY - this.offsetTop;
    }

    function mouseLeave(e) {
        mouseUp(e);
    }

    function resize() {
        timelineCanvas.setAttribute("width", timelineCanvas.clientWidth);
        timelineCanvas.setAttribute("height", timelineCanvas.clientHeight);
        refresh();
    }

    return { init, segments, refresh, resize, getCurrentTime, setCurrentTime };
})();

var GifGenerator = (function() {

    function init() {
        document.getElementById("gen-gif-btn").onclick = generate;
    }

    function generate() {
        if(Timeline.segments.length > 0) {
            document.getElementById("dim-overlay").style.display = "block";
            var encoder = new GIFEncoder();
            Display.play(encoder);
        }
    }

    function encode(encoder, frames) {
        document.getElementById("progress-lbl").innerHTML = "Encoding";
        var progress_bar = document.getElementById("progress-bar");
        progress_bar.value = 0;
        progress_bar.max = frames.length;

        console.log(frames.length + " frames captured");
        encoder.setRepeat(0);       // loop until told to stop
        encoder.setDelay(50);       // capture every x ms
        encoder.setSize(canvas.width, canvas.height);
        encoder.setProperties(true, true); // started, firstFrame
        encoder.start();

        function finished() {
            console.log("finished encoding");
            encoder.finish();
            var binaryGIF = encoder.stream().getData();
            var base64 = encode64(binaryGIF);
            upload(base64);
        }

        function upload(dataURL) {
            document.getElementById("progress-lbl").innerHTML = "Uploading";
            progress_bar.value = 0;
            progress_bar.max = 4;
            var xmlHttp = new XMLHttpRequest();
            xmlHttp.onreadystatechange = function() {
                progress_bar.value = xmlHttp.readyState;

                // once upload has finished, navigate to gif location
                if(xmlHttp.readyState == 4) {
                    if(xmlHttp.status == 200) {
                        console.log("finished uploading");
                        var gifID = JSON.parse(xmlHttp.responseText).id;
                        window.location.assign("/gif/" + gifID + ".gif");
                    } else {
                        console.log("upload failed");
                    }
                    document.getElementById("dim-overlay").style.display = "none";
                } else {
                    console.log(xmlHttp.responseText);
                }
            }
            console.log("uploading");
            xmlHttp.open("POST", "/upload", true);   // true for asynchronous
            xmlHttp.setRequestHeader("Content-type", "application/json");
            xmlHttp.send(JSON.stringify({ img: dataURL }));
            console.log("sent upload request");
        }

        console.log("encoding");

        var frameIndex = 0;
        (function loop() {
            var frame = frames[frameIndex];
            encoder.addFrame(frame, true);
            encoder.setProperties(true, false); // started, firstFrame
            progress_bar.value = frameIndex;
            frameIndex ++;
            if(frameIndex < frames.length) {
                setTimeout(loop, 0);
            } else {
                finished();
            }
        })();
    }

    return { init, encode };
})();

// a nice helper function
// https://stackoverflow.com/questions/38173871/html5-canvas-how-to-border-a-fillrect
function drawBorderRect(context, xPos, yPos, width, height, borderColor = "#fff", rectColor = "#aaa", thickness = 6) {
    //context.fillStyle = borderColor;
    //context.fillRect(xPos - (thickness), yPos - (thickness), width + (thickness * 2), height + (thickness * 2));
    context.fillStyle = rectColor;
    context.fillRect(xPos, yPos, width, height);
}

main();
})();

// navigate to the home page
function navToHome() {
    window.location.assign("../home-page/home.html");
}
