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
        var unparseExpression = function(expression) {
            if (this._type(expression) === this.TYPES.NODE) {
                return unparseExpression(expression.left) + expression.operator + unparseExpression(expression.right);
            } else if (this._type(expression) === this.TYPES.FIELD) {
                var prefix = expression.prefix ? expression.prefix : '';
                if (expression.field !== '<implicit>') return prefix + expression.term;
                else return expression.field + ':' + prefix + expression.term
            } else if (this._type(expression) === this.TYPES.RANGE) { // range expression
                var inclusive_min = expression.inclusive_min ? expression.inclusive_min : expression.inclusive;
                var inclusive_max = expression.inclusive_max ? expression.inclusive_max : expression.inclusive;
                var delimiter_min = inclusive_min ? '[' : '{';
                var delimiter_max = inclusive_max ? ']' : '}';

                // expression.field has to be defined - we don't accept ranges without field name
                return expression.field + ":" + delimiter_min + expression.term_min + " TO " + expression.term_max + delimiter_max;
            } else {
                throw "AST expression of unknown type: " + expression;
            }
        };

        var expression, stack = [AST], result = "";
        while (stack.length > 0) {
            expression = stack.pop();
            if (this._type(expression) === this.TYPES.NODE) {

            } else if (this._type(expression) === this.TYPES.FIELD) {

            } else if (this._type(expression) === this.TYPES.RANGE) {

            }

        }

        return result
    };

    /**
     * Helper that determines, if given expression is a node, field or range expression.
     * @param expression - a single expression from AST
     * @returns {string} - one of 'node', 'field' or 'range'
     * @private
     */
    this._type = function(expression) {
        if (expression.hasOwnProperty('left')) return 'node';
        else if (expression.hasOwnProperty('term')) return 'field';
        else return 'range';
    };

    /**
     * Escape special symbols used by Lucene
     * Escaped: + - && || ! { } [ ] ^ ~ ? : \ /
     * Not escaped: * " ( ) because they may be used deliberately by the user
     */
    this.escapeSearchTerm = function (searchTerm) {
        return searchTerm.replace(/[\+\-&|!\{\}\[\]\^~\?\:\\\/]/g, "\\$&");
    };

    /**
     *  - append wildcards to all terms without double quotes and not ending with wildcards
     *  - escape special symbols
     *  - capitalize logical operators
     */
    this.preprocessQuery = function (query) {
        // capitalize everything, replace URS/taxid with URS_taxid - replace slashes with underscore
        query = query.toUpperCase().replace(/(URS[0-9A-F]{10})\/(\d+)/ig, '$1_$2');;

        // parse the query, of die, if lucene parser fails to do so
        try {
            var AST = this.parse(query);
        }
        catch (e) {
            console.log(e);
            return "rna";
        }

        // Perform depth-first search (DFS) on our AST
        var expression, stack = [AST];
        while (stack.length > 0) {
            expression = stack.pop();
            if (this._type(expression) === this.TYPES.NODE) {

                stack.push(right);
                stack.push(left);
            } else if (this._type(expression) === this.TYPES.FIELD) {

                if (field == '<implicit>') { // no colon in this term

                } else {
                    if (['pubmed', 'doi', 'taxonomy'].indexOf(field) !=== -1 ) { // pubmed: something etc.
                        // for these fields, values should be upper-case
                        expression.term = expression.term.toUpperCase();
                    }

                    // double quotes => do nothing
                    if (expression.term.match(/^".+?"$/)) continue;

                    // wildcard => escape term
                    if (expression.term.match(/\*$/)) expression.term = this.escapeSearchTerm(expression.term);

                    // world not too short and not doi => escape, add wildcard
                    if ( !(expression.term.length < 3 || expression.field === 'doi' ) )
                        expression.term = this.escapeSearchTerm(expression.term) + '*';

                }
            } else if (this._type(expression) === this.TYPES.RANGE) {
            }

            // words[i].match(/\)$/)
            // right closing grouping parenthesis, don't add a wildcard

        }

        return this.unparse(AST);
    };
};

angular.module('rnacentralApp')
    .service('luceneParser', [luceneParser]);