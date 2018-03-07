/*
Copyright [2009-2017] EMBL-European Bioinformatics Institute
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at
     http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/


var luceneParser = function() {
    // Helpers
    // -------

    var TYPES = {'NODE': 'NODE', 'FIELD': 'FIELD', 'RANGE': 'RANGE'};

    /**
     * Helper that determines, if given expression is a node, field or range expression.
     * @param expression - a single expression from AST
     * @returns {string} - one of 'node', 'field' or 'range'
     * @private
     */
    var _type = function(expression) {
        if (expression.hasOwnProperty('left')) return TYPES.NODE;
        else if (expression.hasOwnProperty('term')) return TYPES.FIELD;
        else if (expression.hasOwnProperty('term_min')) return TYPES.RANGE;
        else throw "AST expression of unknown type: " + JSON.stringify(expression);
    };

    // luceneParser methods
    // --------------------

    /**
     * Parses Lucene queries into an Abstract Syntax Tree (AST) that consists of
     * 3 types of expressions:
     *
     * NODE expressions:
     *
     * {
     *     'left' : dictionary,     // field OR node expression
     *     'operator': string,      // operator value
     *     'right': dictionary,     // field OR node expression
     *     'field': string          // field name (for field group syntax) [OPTIONAL]
     * }
     *
     * FIELD expressions:
     *
     * {
     *     'field': string,         // field name
     *     'term': string,          // term value
     *     'prefix': string         // prefix operator (+/-) [OPTIONAL]
     *     'boost': float           // boost value, (value > 1 must be integer) [OPTIONAL]
     *     'similarity': float      // similarity value, (value must be > 0 and < 1) [OPTIONAL]
     *     'proximity': integer     // proximity value [OPTIONAL]
     * }
     *
     * RANGE expressions:
     *
     * {
     *     'field': string,         // field name
     *     'term_min': string,      // minimum value (left side) of range
     *     'term_max': string,      // maximum value (right side) of range
     *     'inclusive': boolean     // true: range is inclusive ([...]) or false: exclusive ({...})
     *     'inclusive_min': boolean     // true: min value is inclusive ([...) or false: exclusive ({...)
     *     'inclusive_max': boolean     // true: max value is inclusive (...]) or false: exclusive (...})
     * }
     *
     * If field is empty, e.g. query is just "rna", field is set to '<implicit>'.
     *
     * @param {string} query
     * @returns {Object} - AST
     */
    this.parse = function(query) {
        return new AST(query);
    };

    /**
     * Checks, if search query contains any lucene-specific syntax, or if it's a plain text
     * @param {string} query
     * @returns {boolean} true, if it's a complex lucene expression, false - if it's just a plaintext search
     */
    this.luceneSyntaxUsed = function(query) {
        var AST = this.parse(query);
        return (!AST.hasOwnProperty('right') && AST.left.field == '<implicit>');
    };


    // AST constructor and methods
    // ---------------------------

    /**
     * Creates a new Abstract Syntax Tree from lucene query.
     * @param query
     * @constructor
     */
    var AST = function(query) {
        /**
         * Capitalize lucene AND/OR/NOT/TO words, replace slashes with underscores
         * @param query
         * @private
         */
        _preprocess = function (query) {
            return query.match(/[^\s"]+|"[^"]*"/g) // split into words: http://stackoverflow.com/questions/366202/regex-for-splitting-a-string-using-space-when-not-surrounded-by-single-or-double
                        .map(function(word) { return word.match(/^(and|or|not|to)$/gi) ? word.toUpperCase() : word }) // capitalize AND, OR, NOT and TO
                        .reduce(function(query, word) { return query + " " + word }) // join words
                        .replace(/: /g, ':') // avoid spaces after faceted search terms
                        .replace(/(URS[0-9A-F]{10})\/(\d+)/ig, '$1_$2'); // replace slashes with underscores
        };

        /**
         * Escape special symbols used by Lucene
         * Escaped: + - && || ! { } [ ] ^ ~ ? : \ /
         * Not escaped: * " ( ) because they may be used deliberately by the user
         * @private
         */
        var _escape = function (searchTerm) {
            return searchTerm.replace(/[\+\-&|!\{\}\[\]\^~\?\:\\\/]/g, "\\$&");
        };

        /**
         * Adds parent property to each AST element that points to its parent
         * node element.
         * @param {object} AST
         * @returns {object} copy of AST with denoted
         */
        var ASTWithParents = function(AST) {
            var clone = JSON.parse(JSON.stringify(AST)); // clone the AST, ineffective though
            clone.parent = null; // root of the tree has null parent

            var top, stack = [clone];
            while (stack.length > 0) {
                top = stack.shift();
                if (_type(top) === TYPES.NODE) {
                    stack.unshift(top.left);
                    top.left.parent = top;

                    if (top.hasOwnProperty('right')) {
                        stack.unshift(top.right);
                        top.right.parent = top;
                    }
                }
            }

            return clone;
        };

        query = _preprocess(query);
        var ast = lucenequeryparser.parse(query);
        ast = ASTWithParents(ast);
        _.extend(this, ast);
    };

    /**
     * Inverse to parsing - assemble a query string back from AST
     * @returns {string} - Lucene query string
     */
    AST.prototype.unparse = function() {
        var result = "";
        var stack = [AST]; // this is stack maintained for DFS

        var expression; // expression is the currently evaluated
        while (stack.length > 0) {
            // we're using shift/unshift instead of push/pop in order to avoid reversing arguments order
            expression = stack.shift();

            if (typeof expression == 'string') {
                result = result + expression;
            } else if (_type(expression) === TYPES.NODE) {
                if (expression.hasOwnProperty('right')) {
                    if (expression === AST) stack.unshift(expression.left, ' ', expression.operator, ' ', expression.right);
                    else stack.unshift('(', expression.left, ' ', expression.operator, ' ', expression.right, ')');
                } else {
                    stack.unshift(expression.left);
                }
            } else if (_type(expression) === TYPES.FIELD) {
                var prefix = expression.prefix ? expression.prefix : '';
                if (expression.field === '<implicit>') result += prefix + expression.term;
                else {
                    if (['pubmed', 'doi', 'taxonomy'].indexOf(expression.field) !== -1 ) {
                        expression.term = expression.term.toUpperCase();
                    }

                    result += expression.field + ':' + prefix + '"' + expression.term + '"';
                }
            } else if (_type(expression) === TYPES.RANGE) {
                var inclusive_min = expression.inclusive_min ? expression.inclusive_min : expression.inclusive;
                var inclusive_max = expression.inclusive_max ? expression.inclusive_max : expression.inclusive;
                var delimiter_min = inclusive_min ? '[' : '{';
                var delimiter_max = inclusive_max ? ']' : '}';

                // expression.field has to be defined - we don't accept ranges without field name
                result += expression.field + ":" + delimiter_min + expression.term_min + " TO " + expression.term_max + delimiter_max;
            } else {
                throw "AST expression of unknown type: " + expression;
            }

        }

        return result
    };

    /**
     * Returns all occurrences of a named field with a certain term
     * @param {string} field
     * @param {string|object} [term] - string for FIELD expressions, object {} for RANGE expressions,
     *   if undefined, check for equality of terms is not performed
     * @returns {Array} - array of found expression objects
     */
    AST.prototype.findField = function(field, term) {
        var top; // top of the stack
        var stack = [AST];
        var results = [];
        while (stack.length > 0) {
            top = stack.shift();
            if (_type(top) === TYPES.FIELD) {
                if (top.field === field) {
                    if (top.term && top.term === term) results.push(top);
                    else if (typeof(term) === 'undefined') results.push(top);
                }
            } else if (_type(top) === TYPES.RANGE) {
                if (typeof(term) === 'undefined') results.push(top);
                else if (top.field === field &&
                    top.term_min === term.term_min &&
                    top.term_max === term.term_max &&
                    top.inclusive_min === term.inclusive_min &&
                    top.inclusive_max === term.inclusive_max) results.push(top);
            } else if (_type(top) === TYPES.NODE) {
                stack.unshift(top.left);
                if (top.hasOwnProperty('right')) stack.unshift(top.right);
            }
        }

        return results;
    };

    /**
     * Removes all the occurrences of named field from AST.
     * @param {string} field
     * @param {string|object} [term] - field is removed only if its value equals to term or
     * @returns {object} AST with specified fields removed
     */
    AST.prototype.removeField = function(field, term) {
        var otherChild, parentToGrandparent;
        var hits = this.findField(field, term); // we need to get rid of these expressions
        hits.forEach(function(hit) {
            // if parent has both left and right children, get rid of hit.parent and replace it with parent's otherChild
            if (hit.parent.hasOwnProperty('right')) {
                otherChild = hit.parent.left === hit ? hit.parent.right : hit.parent.left;

                if (hit.parent.parent === null) { // special case: hit.parent is root
                    hit.parent.left = otherChild;
                    delete hit.parent.right;
                } else {
                    parentToGrandparent = hit.parent.parent.left === hit.parent ? 'left' : 'right';
                    hit.parent.parent[parentToGrandparent] = otherChild;
                }
            } else { // parent has only one child and needs to go, too, unless it's root
                if (hit.parent.parent === null) {
                    delete hit.parent.left; // TODO: is this a meaningful empty tree?
                } else {
                    var uncle = hit.parent.parent.left == hit.parent ? hit.parent.parent.right : hit.parent.parent.left;
                    hit.parent.parent.left = uncle;
                    delete hit.parent.parent.right;
                }
            }
        });
    };

    /**
     * Adds a field to the top of the AST (when stringified, it is going
     * to be the last part of query string).
     * @param {object} field - FIELD or RANGE expression
     * @param {string} operator - e.g. 'AND', 'OR'
     * @returns {object} newAST
     */
    AST.prototype.addField = function(field, operator) {
        var newAST = { left: AST, operator: operator, right: field};
        if (AST.hasOwnProperty('parent')) {
            AST.parent = newAST;
            newAST.parent = null;
        }
        return newAST;
    };
};

angular.module('textSearch')
    .service('luceneParser', [luceneParser]);