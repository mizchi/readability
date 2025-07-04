/* eslint-env node, mocha */

var debug = false;

var path = require("path");
var fs = require("fs");
var JSDOM = require("jsdom").JSDOM;
var prettyPrint = require("./utils").prettyPrint;
var http = require("http");
var urlparse = require("url").parse;
var htmltidy = require("htmltidy2").tidy;

var { Readability, isProbablyReaderable } = require("../index");
var JSDOMParser = require("../JSDOMParser");

var FFX_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:80.0) Gecko/20100101 Firefox/80.0";

var testcaseRoot = path.join(__dirname, "test-pages");

var argURL = process.argv[3]; // Could be undefined, we'll warn if it is if that is an issue.

function generateTestcase(slug) {
  var destRoot = path.join(testcaseRoot, slug);

  fs.mkdir(destRoot, function (err) {
    if (err) {
      var sourceFile = path.join(destRoot, "source.html");
      fs.exists(sourceFile, function (exists) {
        if (exists) {
          fs.readFile(sourceFile, { encoding: "utf-8" }, function (readFileErr, data) {
            if (readFileErr) {
              console.error("Source existed but couldn't be read?");
              process.exit(1);
              return;
            }
            onResponseReceived(null, data, destRoot);
          });
        } else {
          fetchSource(argURL, function (fetchErr, data) {
            onResponseReceived(fetchErr, data, destRoot);
          });
        }
      });
      return;
    }
    fetchSource(argURL, function (fetchErr, data) {
      onResponseReceived(fetchErr, data, destRoot);
    });
  });
}

function fetchSource(url, callbackFn) {
  if (!url) {
    console.error("You should pass a URL if the source doesn't exist yet!");
    process.exit(1);
    return;
  }
  var client = http;
  if (url.indexOf("https") == 0) {
    client = require("https");
  }
  var options = urlparse(url);
  options.headers = { "User-Agent": FFX_UA };

  client.get(options, function (response) {
    if (debug) {
      console.log("STATUS:", response.statusCode);
      console.log("HEADERS:", JSON.stringify(response.headers));
    }
    response.setEncoding("utf-8");
    var rv = "";
    response.on("data", function (chunk) {
      rv += chunk;
    });
    response.on("end", function () {
      if (debug) {
        console.log("End received");
      }
      sanitizeSource(rv, callbackFn);
    });
  });
}

function sanitizeSource(html, callbackFn) {
  htmltidy(
    new JSDOM(html).serialize(),
    {
      indent: true,
      "indent-spaces": 4,
      "numeric-entities": true,
      "output-xhtml": true,
      wrap: 0,
    },
    callbackFn
  );
}

function onResponseReceived(error, source, destRoot) {
  if (error) {
    console.error("Couldn't tidy source html!");
    console.error(error);
    return;
  }
  if (debug) {
    console.log("writing");
  }
  var sourcePath = path.join(destRoot, "source.html");
  fs.writeFile(sourcePath, source, function (err) {
    if (err) {
      console.error("Couldn't write data to source.html!");
      console.error(err);
      return;
    }
    if (debug) {
      console.log("Running readability stuff");
    }
    runReadability(
      source,
      path.join(destRoot, "expected.html"),
      path.join(destRoot, "expected-metadata.json")
    );
  });
}

function runReadability(source, destPath, metadataDestPath) {
  var uri = "http://fakehost/test/page.html";
  var doc = new JSDOMParser().parse(source, uri);
  var myReader, result, readerable;
  try {
    // We pass `caption` as a class to check that passing in extra classes works,
    // given that it appears in some of the test documents.
    myReader = new Readability(doc, { classesToPreserve: ["caption"] });
    result = myReader.parse();
  } catch (ex) {
    console.error(ex);
    ex.stack.forEach(console.log.bind(console));
  }
  // Use jsdom for isProbablyReaderable because it supports querySelectorAll
  try {
    var jsdomDoc = new JSDOM(source, {
      url: uri,
    }).window.document;
    myReader = new Readability(jsdomDoc);
    readerable = isProbablyReaderable(jsdomDoc);
  } catch (ex) {
    console.error(ex);
    ex.stack.forEach(console.log.bind(console));
  }
  if (!result) {
    console.error("No content generated by readability, not going to write expected.html!");
    return;
  }

  fs.writeFile(destPath, prettyPrint(result.content), function (fileWriteErr) {
    if (fileWriteErr) {
      console.error("Couldn't write data to expected.html!");
      console.error(fileWriteErr);
    }

    // Delete the result data we don't care about checking.
    delete result.content;
    delete result.textContent;
    delete result.length;

    // Add isProbablyReaderable result
    result.readerable = readerable;

    fs.writeFile(
      metadataDestPath,
      JSON.stringify(result, null, 2) + "\n",
      function (metadataWriteErr) {
        if (metadataWriteErr) {
          console.error("Couldn't write data to expected-metadata.json!");
          console.error(metadataWriteErr);
        }
      }
    );
  });
}

if (process.argv.length < 3) {
  console.error(
    "Need at least a destination slug and potentially a URL (if the slug doesn't have source)."
  );
  process.exit(0);
  throw new Error("Abort");
}

if (process.argv[2] === "all") {
  fs.readdir(testcaseRoot, function (err, files) {
    if (err) {
      console.error("error reading testcaseses");
      return;
    }

    files.forEach(function (file) {
      generateTestcase(file);
    });
  });
} else {
  generateTestcase(process.argv[2]);
}
