var textSearchResults = {
    bindings: {},
    templateUrl: '/static/js/components/text-search/text-search-results/text-search-results.html',
    controller: ['$interpolate', '$location', '$http', '$timeout', '$scope', '$filter', '$q', 'search', 'LuceneAST', 'routes',
    function($interpolate, $location, $http, $timeout, $scope, $filter, $q, search, LuceneAST, routes) {
        var ctrl = this;

        ctrl.$onInit = function() {
            // expose search service in template
            ctrl.search = search;

            // error flags for UI state
            ctrl.showExportError = false;
            ctrl.showExpertDbError = false;

            // urls used in template (hardcoded)
            ctrl.routes = routes;

            // slider that allows users to set range of sequence lengths
            ctrl.setLengthSlider(search.query); // initial value

            search.registerSearchCallback(function() { ctrl.setLengthSlider(search.query); });

            // retrieve expert_dbs json for display in tooltips
            $http.get(routes.expertDbsApi({ expertDbName: '' })).then(
                function(response) {
                    ctrl.expertDbs = response.data;

                    // expertDbsObject has lowerCase db names as keys
                    ctrl.expertDbsObject = {};
                    for (var i=0; i < ctrl.expertDbs.length; i++) {
                        ctrl.expertDbsObject[ctrl.expertDbs[i].name.toLowerCase()] = ctrl.expertDbs[i];
                    }
                },
                function(response) {
                    ctrl.showExpertDbError = true;
                }
            );
        };

        // Length slider-related code
        // --------------------------

        /**
         * Sets new value of length slider upon init or search.
         * @param newQuery
         * @param oldQuery
         */
        ctrl.setLengthSlider = function(query) {
            var min, max, floor, ceil;

            // find min/max length in query, get floor/ceil by sending query without lengthClause
            var queryMin, queryMax;
            var lengthField = search.AST.findField('length');
            if (lengthField.length !== 0) {
                queryMin = parseInt(lengthField[0].term_min);
                queryMax = parseInt(lengthField[0].term_max);
            }
            search.AST.removeField('length');
            var filteredQuery = search.AST.unparse();

            /**
             * Small internal function that updates slider with new floor/ceil (and min/max, if necessary).
             */
            function _setLengthSlider(floor, ceil, queryMin, queryMax) {
                if (typeof(queryMin) !== 'undefined' && typeof(queryMax) !== 'undefined' ) {
                    min = queryMin < floor ? floor : queryMin;
                    max = queryMax > ceil ? ceil : queryMax;
                } else {
                    min = floor;
                    max = ceil;
                }

                ctrl.lengthSlider = ctrl.LengthSlider(min, max, floor, ceil);
                $timeout(function () { $scope.$broadcast('rzSliderForceRender'); }); // issue render just in case
            }

            ctrl.getFloorCeil(filteredQuery).then(
                function(floorceil) {
                    floor = parseInt(floorceil[0].data.entries[0].highlights.length);
                    ceil = parseInt(floorceil[1].data.entries[0].highlights.length);

                    _setLengthSlider(floor, ceil, queryMin, queryMax);
                },
                function (failure) { // non-mission critical, let's fallback to sensible defaults
                    floor = 10;
                    ceil = 2147483647; // macrocosm constant apparently - if length exceeds it, EBI search fails

                    _setLengthSlider(floor, ceil, queryMin, queryMax);
                }
            );
        };

        /**
         * Issues additional queries to EBI search to get lowest and highest
         * lengths of sequences in this query.
         *
         * @param query - value of search.query
         * @returns {Promise} - resolves to Array of [floor, ceil]
         */
        ctrl.getFloorCeil = function(query) {
            function createEbeyeUrl(ascending) {
                ascending = ascending ? "ascending" : "descending";

                return routes.ebiSearch({
                    ebiBaseUrl: global_settings.EBI_SEARCH_ENDPOINT,
                    query: query ? LuceneAST._preprocess(query): query,
                    hlfields: "length",
                    facetcount: "",
                    facetfields: "length",
                    size: 1,
                    start: 0,
                    sort: "length:" + ascending
                });
            }

            var ascendingEbeyeUrl = createEbeyeUrl(true);
            var descendingEbeyeUrl = createEbeyeUrl(false);

            var ascendingQueryUrl = routes.ebiSearchProxy({ebeyeUrl: encodeURIComponent(ascendingEbeyeUrl)});
            var descendingQueryUrl = routes.ebiSearchProxy({ebeyeUrl: encodeURIComponent(descendingEbeyeUrl)});

            return $q.all([$http.get(ascendingQueryUrl), $http.get(descendingQueryUrl)]);
        };

        /**
         * Constructor-ish function (but no 'new' needed) that returns a model for length slider
         */
        ctrl.LengthSlider = function(min, max, floor, ceil) {
            return {
                min: min,
                max: max,
                options: {
                    floor: floor,
                    ceil: ceil,
                    logScale: true,
                    translate: function(value) {
                        if (value < 10000) return $filter('number')(value);
                        else return Number(Math.floor(value/1000)).toString() + 'k';
                    },
                    onEnd: function () { ctrl.facetSearch('length') }
                }
            };
        };

        /**
         * Resets slider to default value
         */
        ctrl.resetSlider = function() {
            self.AST.removeField('length');
            var filteredQuery = LuceneAST.unparse();
            search.search(filteredQuery);
        };

        // Facets-related code
        // -------------------

        /**
         * Run a search with a facet enabled.
         * The facet will be toggled on and off in the repeated calls with the same
         * parameters.
         */
        ctrl.facetSearch = function(facetId, facetValue) {
            if (facetId !== 'length') {
                if (search.AST.findField(facetId, facetValue).length > 0) { // remove facet
                    search.AST.removeField(facetId, facetValue);
                } else { // add new facet
                    addFacet(facetId, facetValue);
                }
            } else {
                var field = {
                    field: 'length',
                    term_min: ctrl.lengthSlider.min,
                    term_max: ctrl.lengthSlider.max,
                    inclusive: true,
                    inclusive_min: true,
                    inclusive_max: true
                };
                if (search.AST.findField(facetId).length > 0) {
                    search.AST.removeField(facetId);
                    search.AST.addField(field, 'AND');
                } else {
                    search.AST.addField(field, 'AND');
                }
            }

            search.search(search.AST.unparse());
        };

        var addFacet = function(facetId, facetValue) {
            var field, sameFacet;

            field = {
                field: facetId,
                term: facetValue,
                prefix: undefined,
                boost: undefined,
                similarity: undefined,
                proximity: undefined
            };

            sameFacet = search.AST.findField(facetId);
            if (sameFacet.length > 0) {
                // Suppose that we have a query: 'expert_db:"ENA" OR expert_db:"RFAM" OR expert_db:"HGNC"'.
                // In such case we need to add another expert_db:"<something>" to that whole subtree only once.

                var sameFacetSubtrees = []; // contains only the root of subtree (if it's 1-element subtree, it is root)
                var nonVisited = sameFacet.slice();
                var newSubtree = true; // flags that we started to walk a new subtree
                while (nonVisited.length > 0) {
                    /**
                     * I assume that sameSubtree is like:
                     * ----------------------------------
                     *
                     *           /
                     *          /\
                     *         /\ \
                     *        /\ \ \
                     *
                     *  and never like:
                     *  ---------------
                     *
                     *           /
                     *          /\
                     *         /  \
                     *        /\  /\
                     *
                     **/

                    var current = nonVisited.shift(); // iterates over nonVisited (which are tree leaves)

                    if (newSubtree) { // new subtree must start with this element, otherwise it's a 1-element subtree
                        if (current.parent.left !== current) sameFacetSubtrees.push(current);
                        else newSubtree = false;
                    } else { // it's a continuation of subtree, check when it ends
                        var rightNeighbor;
                        if (current === current.parent.left) rightNeighbor = current.parent.right;
                        else rightNeighbor = current.parent.parent !== null ? current.parent.parent.right : null;

                        if (nonVisited.length === 0 || nonVisited[0] !== rightNeighbor || rightNeighbor.parent.operator !== 'OR') {
                            sameFacetSubtrees.push(current.parent); // if it's a whole subtree, push its root
                            newSubtree = true;
                        }
                    }
                }

                sameFacetSubtrees.forEach(function(subtreeRightmostLeaf) {
                    search.AST.addField(field, 'OR', subtreeRightmostLeaf);
                });

            } else {
                search.AST.addField(field, 'AND');
            }
        };

        /**
         * Show/hide search facets to save screen space.
         * Uses jQuery for simplicity.
         * Activated only on mobile devices.
         */
        ctrl.toggleFacets = function() {
            var facets = $('.text-search-facets');
            facets.toggleClass('hidden-xs', !facets.hasClass('hidden-xs'));
            $('#toggle-facets').text(function(i, text) {
                 return text === "Show facets" ? "Hide facets" : "Show facets";
            });

            // if facets were hidden, this is required to render the slider
            $timeout(function () { $scope.$broadcast('rzSliderForceRender'); });

        };

        /**
         * Launch results export.
         * - submit export job
         * - open the results page in a new window.
         */
        ctrl.exportResults = function(format) {
            $http.get(ctrl.routes.submitQuery() + '?q=' + ctrl.search.result._query + '&format=' + format).then(
                function(response) {
                    ctrl.showExportError = false;
                    window.location.href = ctrl.routes.resultsPage() + '?job=' + response.data.job_id;
                },
                function(response) {
                    ctrl.showExportError = true;
                }
            );
        };

        /*
        ctrl.expert_db_logo = function(expert_db) {
            // expert_db can contain some html markup - strip it off, replace whitespaces with hyphens
            expert_db = expert_db.replace(/\s/g, '-').toLowerCase();

            return '/static/img/expert-db-logos/' + expert_db + '.png';
        };
        */

        /**
         * Sorts expertDbs so that starred dbs have priority over non-starred, otherwise, keeping lexicographical order.
         * @param v1 - plaintext db name
         * @param v2 - plaintext db name
         * @returns {number} - (-1 if v1 before v2) or (1 if v1 after v2)
         */
        ctrl.expertDbHasStarComparator = function(v1, v2) {
            if (ctrl.expertDbHasStar(v1.value.toLowerCase()) && !ctrl.expertDbHasStar(v2.value.toLowerCase())) return -1;
            else if (!ctrl.expertDbHasStar(v1.value.toLowerCase()) && ctrl.expertDbHasStar(v2.value.toLowerCase())) return 1;
            else
                return v1.value.toLowerCase() < v2.value.toLowerCase() ? -1 : 1;
        };

        /**
         * We assign a star only to those expert_dbs that have a curated tag and don't have automatic tag at the same time.
         * @param db {String} - name of expert_db as a key in expertDbsObject
         * @returns {boolean}
         */
        ctrl.expertDbHasStar = function(db) {
            return ctrl.expertDbsObject[db].tags.indexOf('curated') != -1 && ctrl.expertDbsObject[db].tags.indexOf('automatic') == -1;
        };

        /**
         * Given EBIsearch results, returns a field name and a highlighted text snippet, matching the query. This
         * helps explain the user, why this result was included into the results list.
         * @param fields {Object} - object of field as returned by search.search()
         * @returns {{highlight: String, fieldName: String}}
         */
        ctrl.highlight = function(fields) {
            var highlight;
            var verboseFieldName;
            var maxWeight = -1; // multiple fields can have highlights - pick the field with highest weight

            for (var fieldName in fields) {
                if (fields.hasOwnProperty(fieldName) && ctrl.anyHighlightsInField(fields[fieldName])) { // description is quoted in hit's header, ignore it
                    if (search.config.fieldWeights[fieldName] > maxWeight) {

                        // get highlight string with match
                        var field = fields[fieldName];
                        for (var i = 0; i < fields.length; i++) {
                            if (field[i].indexOf('text-search-highlights') !== -1) {
                                highlight = field[i];
                                break;
                            }
                        }

                        // assign the new weight and verboseFieldName
                        maxWeight = search.config.fieldWeights[fieldName];
                        verboseFieldName = search.config.fieldVerboseNames[fieldName];
                    }
                }
            }

            // use human-readable fieldName
            return {highlight: highlight, fieldName: verboseFieldName};
        };

        /**
         * Are there any highlighted snippets in search results at all?
         */
        ctrl.anyHighlights = function(fields) {
            for (var fieldName in fields) {
                if (fields.hasOwnProperty(fieldName) && ctrl.anyHighlightsInField(fields[fieldName])) {
                    return true;
                }
            }
            return false;
        };

        /**
         * Does the given field contain any highlighted text snippets?
         */
        ctrl.anyHighlightsInField = function(field) {
            for (var i=0; i < field.length; i++) {
                if (field[i].indexOf('text-search-highlights') !== -1) {
                    return true;
                }
            }
            return false;
        };
    }]
};

angular.module('textSearch').component('textSearchResults', textSearchResults);
