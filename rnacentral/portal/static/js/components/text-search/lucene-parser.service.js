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
    this.TYPES = {'NODE': 'NODE', 'FIELD': 'FIELD', 'RANGE': 'RANGE'};

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
        return lucenequeryparser.parse(query);
    };

    /**
     * Inverse to parsing - assemble a query string back from AST
     * @param {Object} AST
     * @returns {string} - Lucene query string
     */
    this.unparse = function(AST) {
        var result = "";
        var stack = [AST]; // this is stack maintained for DFS

        var expression; // expression is the currently evaluated
        while (stack.length > 0) {
            // we're using shift/unshift instead of push/pop in order to avoid reversing arguments order
            expression = stack.shift();

            if (typeof expression == 'string') {
                result = result + expression;
            } else if (this._type(expression) === this.TYPES.NODE) {
                if (expression.hasOwnProperty('right')) {
                    if (expression === AST) stack.unshift(expression.left, ' ', expression.operator, ' ', expression.right);
                    else stack.unshift('(', expression.left, ' ', expression.operator, ' ', expression.right, ')');
                } else {
                    stack.unshift(expression.left);
                }
            } else if (this._type(expression) === this.TYPES.FIELD) {
                var prefix = expression.prefix ? expression.prefix : '';
                if (expression.field === '<implicit>') result += prefix + expression.term;
                else {
                    if (['pubmed', 'doi', 'taxonomy'].indexOf(expression.field) !== -1 ) {
                        expression.term = expression.term.toUpperCase();
                    }

                    result += expression.field + ':' + prefix + '"' + expression.term + '"';
                }
            } else if (this._type(expression) === this.TYPES.RANGE) {
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
     * Escape special symbols used by Lucene
     * Escaped: + - && || ! { } [ ] ^ ~ ? : \ /
     * Not escaped: * " ( ) because they may be used deliberately by the user
     */
    this._escape = function (searchTerm) {
        return searchTerm.replace(/[\+\-&|!\{\}\[\]\^~\?\:\\\/]/g, "\\$&");
    };

    /**
     * Helper that determines, if given expression is a node, field or range expression.
     * @param expression - a single expression from AST
     * @returns {string} - one of 'node', 'field' or 'range'
     * @private
     */
    this._type = function(expression) {
        if (expression.hasOwnProperty('left')) return this.TYPES.NODE;
        else if (expression.hasOwnProperty('term')) return this.TYPES.FIELD;
        else if (expression.hasOwnProperty('term_min')) return this.TYPES.RANGE;
        else throw "AST expression of unknown type: " + JSON.stringify(expression);
    };

    /**
     *  - append wildcards to all terms without double quotes and not ending with wildcards
     *  - escape special symbols
     *  - capitalize logical operators
     */
    this.preprocessQuery = function (query) {
        // capitalize everything, replace URS/taxid with URS_taxid - replace slashes with underscore
        query = query.toUpperCase().replace(/(URS[0-9A-F]{10})\/(\d+)/ig, '$1_$2');

        // parse the query, of die, if lucene parser fails to do so
        try { var AST = this.parse(query); }
        catch (e) { console.log(e); return "rna"; }

        return this.unparse(AST);
    };

    /**
     * Returns a list of all occurrences of named field (e.g. 'length: 130' or
     * 'length: [100 TO 200]') in field and range expressions of AST.
     * @param {string} field - name of the field, we're looking for
     * @param {object} AST
     * @param {boolean} [withParent=false]
     * @returns {Array} - Array of expressions (left-to-right) OR
     *  array of pairs {expression: <expression>, parent: <parent>}, where
     *  expression.field === field.
     */
    this.findField = function(field, AST, withParent) {
        var top; // top of the stack
        var stack = [{ expression:AST, parent: null, grandparent: null}]; // dicts {expression: <expression>, parent: <parent>}
        var result = [];
        while (stack.length > 0) {
            top = stack.shift();
            if (this._type(top.expression) !== this.TYPES.NODE) {
                if (withParent) results.push(top);
                else results.push(top.expression);
            } else {
                stack.unshift({expression: top.expression.left, parent: top.expression});
                if (top.expression.hasOwnProperty('right')) {
                    stack.unshift({expression: top.expression.right, parent: top.expression});
                }
            }
        }

        return result;
    };

    /**
     * Removes all the occurrences of named field from AST.
     * @param {string} field
     * @param {object} AST
     * @returns {object} AST without the specified fields
     */
    this.removeField = function(field, AST) {
        var hits = this.findField(field, AST, true); // we need to get rid of these expressions
        hits.forEach(function(hit) {
            hit.parent
        });
    };

};

angular.module('textSearch')
    .service('luceneParser', [luceneParser]);