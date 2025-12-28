/**
 * Multi-Server Row Aggregation
 *
 * Handles fetching and aggregating home screen rows from multiple Jellyfin servers.
 * Similar to Android TV's MultiServerRepository pattern.
 *
 * NOTE: Uses ES5-compatible Promise chains (no async/await) for older Tizen support.
 */

var MultiServerRows = (function () {
   "use strict";

   /**
    * Flatten an array of arrays (ES5-compatible replacement for .flat())
    */
   function flattenArray(arrays) {
      var result = [];
      for (var i = 0; i < arrays.length; i++) {
         if (Array.isArray(arrays[i])) {
            for (var j = 0; j < arrays[i].length; j++) {
               result.push(arrays[i][j]);
            }
         }
      }
      return result;
   }

   function getContinueWatching(limit) {
      return new Promise(function (resolve, reject) {
         if (typeof MultiServerManager === "undefined") {
            resolve(null);
            return;
         }

         var servers = MultiServerManager.getAllServersArray();
         if (!servers || servers.length === 0) {
            resolve([]);
            return;
         }

         console.log(
            "MultiServerRows: Aggregating Continue Watching from",
            servers.length,
            "servers"
         );

         var completed = 0;
         var results = [];

         servers.forEach(function (server, index) {
            JellyfinAPI.getResumeItems(
               server.url,
               server.userId,
               server.accessToken,
               function (err, data) {
                  if (!err && data && data.Items) {
                     data.Items.forEach(function (item) {
                        item.ServerUrl = server.url;
                        item.MultiServerId = server.id;
                        item.ServerName = server.name;
                     });
                     results[index] = data.Items;
                  } else {
                     console.warn(
                        "MultiServerRows: Failed to fetch Continue Watching from",
                        server.name,
                        err
                     );
                     results[index] = [];
                  }

                  completed++;
                  if (completed === servers.length) {
                     var allItems = flattenArray(results);
                     allItems.sort(function (a, b) {
                        var dateA =
                           a.UserData && a.UserData.LastPlayedDate
                              ? new Date(a.UserData.LastPlayedDate)
                              : new Date(0);
                        var dateB =
                           b.UserData && b.UserData.LastPlayedDate
                              ? new Date(b.UserData.LastPlayedDate)
                              : new Date(0);
                        return dateB - dateA;
                     });

                     console.log(
                        "MultiServerRows: Aggregated",
                        allItems.length,
                        "Continue Watching items"
                     );
                     resolve(allItems.slice(0, limit));
                  }
               }
            );
         });
      });
   }

   function getNextUp(limit) {
      return new Promise(function (resolve, reject) {
         if (typeof MultiServerManager === "undefined") {
            resolve(null);
            return;
         }

         var servers = MultiServerManager.getAllServersArray();
         if (!servers || servers.length === 0) {
            resolve([]);
            return;
         }

         console.log(
            "MultiServerRows: Aggregating Next Up from",
            servers.length,
            "servers"
         );

         var completed = 0;
         var results = [];

         servers.forEach(function (server, index) {
            JellyfinAPI.getNextUpItems(
               server.url,
               server.userId,
               server.accessToken,
               function (err, data) {
                  if (!err && data && data.Items) {
                     data.Items.forEach(function (item) {
                        item.ServerUrl = server.url;
                        item.MultiServerId = server.id;
                        item.ServerName = server.name;
                     });
                     results[index] = data.Items;
                  } else {
                     console.warn(
                        "MultiServerRows: Failed to fetch Next Up from",
                        server.name,
                        err
                     );
                     results[index] = [];
                  }

                  completed++;
                  if (completed === servers.length) {
                     var allItems = flattenArray(results);
                     allItems.sort(function (a, b) {
                        var dateA = new Date(
                           a.PremiereDate || a.DateCreated || 0
                        );
                        var dateB = new Date(
                           b.PremiereDate || b.DateCreated || 0
                        );
                        return dateB - dateA;
                     });

                     console.log(
                        "MultiServerRows: Aggregated",
                        allItems.length,
                        "Next Up items"
                     );
                     resolve(allItems.slice(0, limit));
                  }
               }
            );
         });
      });
   }

   function getLatestMedia(libraryId, itemType, limit) {
      return new Promise(function (resolve, reject) {
         if (typeof MultiServerManager === "undefined") {
            resolve(null);
            return;
         }

         var servers = MultiServerManager.getAllServersArray();
         if (!servers || servers.length === 0) {
            resolve([]);
            return;
         }

         console.log(
            "MultiServerRows: Aggregating Latest Media for library",
            libraryId,
            "from",
            servers.length,
            "servers"
         );

         var completed = 0;
         var results = [];

         servers.forEach(function (server, index) {
            JellyfinAPI.getLatestMedia(
               server.url,
               server.userId,
               server.accessToken,
               libraryId,
               itemType,
               function (err, data) {
                  if (!err && data && data.Items) {
                     data.Items.forEach(function (item) {
                        item.ServerUrl = server.url;
                        item.MultiServerId = server.id;
                        item.ServerName = server.name;
                     });
                     results[index] = data.Items;
                  } else {
                     console.warn(
                        "MultiServerRows: Failed to fetch Latest Media from",
                        server.name,
                        err
                     );
                     results[index] = [];
                  }

                  completed++;
                  if (completed === servers.length) {
                     var allItems = flattenArray(results);
                     allItems.sort(function (a, b) {
                        var dateA = new Date(a.DateCreated || 0);
                        var dateB = new Date(b.DateCreated || 0);
                        return dateB - dateA;
                     });

                     console.log(
                        "MultiServerRows: Aggregated",
                        allItems.length,
                        "Latest Media items"
                     );
                     resolve(allItems.slice(0, limit));
                  }
               }
            );
         });
      });
   }

   function getAllLibraries() {
      return new Promise(function (resolve, reject) {
         if (typeof MultiServerManager === "undefined") {
            resolve(null);
            return;
         }

         var servers = MultiServerManager.getAllServersArray();
         if (!servers || servers.length === 0) {
            resolve([]);
            return;
         }

         var hasMultipleServers = servers.length > 1;
         var completed = 0;
         var results = [];

         servers.forEach(function (server, index) {
            JellyfinAPI.getUserViews(
               server.url,
               server.userId,
               server.accessToken,
               function (err, data) {
                  if (!err && data && data.Items) {
                     results[index] = data.Items.map(function (library) {
                        return {
                           library: library,
                           server: server,
                           displayName: hasMultipleServers
                              ? library.Name + " (" + server.name + ")"
                              : library.Name,
                        };
                     });
                  } else {
                     console.warn(
                        "MultiServerRows: Failed to fetch libraries from",
                        server.name,
                        err
                     );
                     results[index] = [];
                  }

                  completed++;
                  if (completed === servers.length) {
                     var allLibraries = flattenArray(results);
                     allLibraries.sort(function (a, b) {
                        var nameCompare = a.library.Name.localeCompare(
                           b.library.Name
                        );
                        if (nameCompare !== 0) return nameCompare;
                        return a.server.name.localeCompare(b.server.name);
                     });

                     resolve(allLibraries);
                  }
               }
            );
         });
      });
   }

   return {
      getContinueWatching: getContinueWatching,
      getNextUp: getNextUp,
      getLatestMedia: getLatestMedia,
      getAllLibraries: getAllLibraries,
   };
})();
