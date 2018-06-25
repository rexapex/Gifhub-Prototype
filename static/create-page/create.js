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

                reader.onload = function(e) {
                    video = document.createElement("video");
                    video.src = e.target.result;
                    video.className += "video-preview";
                    video.setAttribute("id", fileSelector.value);
                    video.setAttribute("draggable", true);
                    video.ondragstart = drag;
                    //video.setAttribute("loop", true);
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
        var segment = Timeline.segments.length > 0 ? Timeline.segments[0] : null;
        var video = segment ? segment.video : null;
        var currentSegment = 0;
        if(video) {
            var frames = [];

            var recorderCallback;
            if(encoder) {
                // record the newly created video track
                recorderCallback = record(encoder, frames);
                // calculate the total duration of all clips
                var totalDuration = 0;
                for(var segment of Timeline.segments) {
                    totalDuration += segment.endTime - segment.startTime;
                }
                document.getElementById("progress-lbl").innerHTML = "Recording";
                document.getElementById("progress-bar").value = 0;
                document.getElementById("progress-bar").max = Math.floor(totalDuration);
            }

            // with help from stack overflow
            // https://stackoverflow.com/questions/4429440/html5-display-video-inside-canvas
            var scale = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
            var left = canvas.width / 2 - (video.videoWidth / 2) * scale;
            var top = canvas.height / 2 - (video.videoHeight / 2) * scale;
            video.currentTime = segment.startTime;
            video.play();

            (function loop() {
                // if the video has ended or the segment has surpassed its duration
                if(video.ended || segment.endTime <= video.currentTime) {
                    // end the previous video
                    video.pause();
                    // try to get the next video
                    currentSegment ++;
                    if(Timeline.segments.length > currentSegment) {
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
                        }
                    }
                }

                if(playing && !video.paused) {
                    // render the video frame
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(video, left, top, video.videoWidth * scale, video.videoHeight * scale);
                    recorderCallback(true, false);

                    // if the user is mousing over the video, display a pause button over the frame
                    if(showPauseButton) {
                        drawPauseButton();
                    }

                    // wait until next render frame
                    requestAnimationFrame(loop);
                }
            })();
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
        var video = Importer.videos.length > 0 ? Importer.videos[0] : null;
        if(video) {
            video.pause();
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
        if(playing) {
            playing = false;
            showPauseButton = false;
            drawPlayButton();
            pause();
        } else {
            playing = true;
            showPauseButton = true;
            drawPauseButton();
            play();
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
//        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    return { init, play, pause };
})();

var Timeline = (function() {
    // references to imported videos with extra data for start time and duration
    var segments = [];

    function init() {
        timelineCanvas.ondragover = allowDrop;
        timelineCanvas.ondrop = drop;
        timelineCanvas.onmousemove = mouseMove;
        timelineCanvas.onclick = mouseDown;
        timelineCanvas.onmouseup = mouseUp;
        timelineCanvas.onresize = onResize; // TODO - doesn't work, use window resize instead
        refresh();
    }

    function update(mousex, mousy, mousedown) {
        
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

        var offsetX = 50;
        for(var segmentIndex in segments) {
            var segment = segments[segmentIndex];
            var imgHeight = timelineCanvas.height * 0.5;
            //var imgWidth = Math.floor(imgHeight * 16 / 9);
            var imgWidth = 200;
            var rectLength = Math.floor(segment.video.duration / totalDuration * (timelineCanvas.width - 100));

            // calculate the co-ordinates and dimensions of the rectangle
            var y = timelineCanvas.height/2-imgHeight/4;
            var height = imgHeight/2;

            var color;
            //console.log(offsetX, offsetX + rectLength, y, y + height)
            if(mousex > offsetX && mousex < offsetX + rectLength &&
                mousey > y && mousey < y + height) {
                // draw 3 rectangle, 2 indicating the edges which can be pressed
                edgeColor = mousedown ? activeColor : hoverColor;
                middleColor = colors[segmentIndex % colors.length];

                // draw the middle rectangle
                drawBorderRect(timelineCtx, offsetX + (rectLength*0.1), y, rectLength * 0.8, height, "#fff", middleColor);

                // draw the edge rectangles
                drawBorderRect(timelineCtx, offsetX, y, rectLength * 0.1, height, "#fff", edgeColor);
                drawBorderRect(timelineCtx, offsetX + (rectLength*0.9), y, rectLength * 0.1, height, "#fff", edgeColor);
            } else {
                // draw one continuous rectangle for the clip
                color = colors[segmentIndex % colors.length];
                drawBorderRect(timelineCtx, offsetX, y, rectLength, height, "#fff", color);
            }

            //timelineCtx.drawImage(video, rectLength/2-imgWidth/2, timelineCanvas.height/2-imgHeight/2, imgWidth, imgHeight);

            offsetX += rectLength;
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
        refresh(e.pageX - this.offsetLeft, e.pageY - this.offsetTop);
    }

    function mouseDown(e) {
        //console.log(e.pageX - this.offsetLeft, e.pageY - this.offsetTop);
        refresh(e.pageX - this.offsetLeft, e.pageY - this.offsetTop, true);
    }

    function mouseUp(e) {
        refresh(e.pageX - this.offsetLeft, e.pageY - this.offsetTop);
    }

    function onResize(e) {
        console.log("resized")
    }

    return { init, segments, refresh };
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
            encoder.finish();
            var binaryGIF = encoder.stream().getData();
            var base64 = encode64(binaryGIF);
            upload(base64);
        //    document.getElementById("the-gif").setAttribute("src", "data:image/gif;base64," + base64);
            document.getElementById("dim-overlay").style.display = "none";
        }

        function upload(dataURL) {
            progress_bar.innerHTML = "Uploading";
            progress_bar.value = 0;
            progress_bar.max = 4;
            var xmlHttp = new XMLHttpRequest();
            xmlHttp.onreadystatechange = function() {
                progress_bar.value = xmlHttp.readyState;

                // once upload has finished, navigate to gif location
                if(xmlHttp.readyState == 4 && xmlHttp.status == 200) {
                    var gifID = JSON.parse(xmlHttp.responseText).id;
                    window.location.assign("/gif/" + gifID + ".gif");
                }
            }
            xmlHttp.open("POST", "/upload", true);   // true for asynchronous
            xmlHttp.setRequestHeader("Content-type", "application/json");
            xmlHttp.send(JSON.stringify({ img: dataURL }));
        }

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
