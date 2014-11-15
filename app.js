/*jshint node:true */
/*global require*/

var Request = require("request"),
    Path    = require("path"),
    Hapi    = require("hapi"),
    Good    = require("good"),
    Async   = require("async");

function optionsUrl(url) {
    "use strict";
    return {
        url: url,
        headers: {
            "Authorization": "token " + process.env.GITHUB_TOKEN,
            "User-Agent": "request"
        }
    };
}

var server = new Hapi.Server("0.0.0.0", process.env.PORT || 5000);

server.views({
    engines: {
        html: require("handlebars")
    },
    path: Path.join(__dirname, "templates")
});

function repositoryHasGHPagesBranch(repo, callback) {
    "use strict";
    Request.get(optionsUrl(repo.branches_url.replace(/{\/branch}$/, "")), function (error, response, body) {
        var branches = JSON.parse(body);
        callback(branches.filter(function (branch) {
            return branch.name === "gh-pages";
        }).length > 0);
    });
}

var second = 1000;
server.method("getGithubData", function (user, next) {
    "use strict";
    Request.get(optionsUrl("https://api.github.com/users/" + user + "/repos"), function (error, response, body) {
        if (error) {
            next(error);
        } else {
            var repos = JSON.parse(body);
            Async.filter(repos, repositoryHasGHPagesBranch, function (result) {
                next(null, result);
            });
        }
    });
}, {
    cache: {
        expiresIn: 60 * second
    }
});

server.route({
    method: "GET",
    path: "/",
    handler: function (request, reply) {
        "use strict";
        var user = request.query.user || "Mark-Simulacrum";
        server.methods.getGithubData(user, function (error, result) {
            reply.view("index", { repos: result, user: user });
        });
    }
});

server.pack.register({
    plugin: Good,
    options: {
        reporters: [{
            reporter: require("good-console"),
            args:[{ log: "*", request: "*" }]
        }]
    }
}, function (err) {
    "use strict";
    if (err) {
        throw err; // something bad happened loading the plugin
    }

    server.start(function () {
        server.log("info", "Server running at: " + server.info.uri);
    });
});

server.start();
