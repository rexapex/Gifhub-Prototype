(function() {
    function main() {
        getGifList(function(list) {
            list.forEach(function(item) {
                console.log("gif: " + item);
                getGif(item);
            });
        });
    }

    function getGifList(callback) {
        var xmlHttp = new XMLHttpRequest();
        xmlHttp.onreadystatechange = function() {
            // callback with a list of gif file names
            if(xmlHttp.readyState == 4 && xmlHttp.status == 200) {
                if(callback) {
                    callback(JSON.parse(xmlHttp.responseText).files);
                }
            }
        }
        xmlHttp.open("GET", "/gifs", true);   // true for asynchronous
        xmlHttp.send(null);
    }

    function getGif(filename) {
        if(filename) {
            var img = document.createElement("img");
            img.classList.add("box");
            img.setAttribute("src", "/gif/" + filename);
            document.getElementById("column-container").appendChild(img);
        }
    }

    main();
})();

// navigate to the create gif page
function navToCreateGIF() {
    window.location.assign("../create-page/create.html");
}
