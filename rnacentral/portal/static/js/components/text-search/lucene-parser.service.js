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
    /**
     * Parses Lucene queries into an Abstract Syntax Tree (AST) that consists of
     * 3 types of expressions:
     *
     * Node expressions:
     *
     * {
     *     'left' : dictionary,     // field expression or node
     *     'operator': string,      // operator value
     *     'right': dictionary,     // field expression OR node
     *     'field': string          // field name (for field group syntax) [OPTIONAL]
     * }
     *
     * Field expressions:
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
     * Range expressions:
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
    this.ASTtoString = function(AST) {
        var expression, stack = [AST], result = "";
        while (stack.length > 0) {
            expression = stack.pop();
            if (expression.left) { // node expression

            } else if (expression.term) { // field expression

            } else { // range expression

            }

        }

        return result
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
            if (expression.hasOwnProperty('left')) { // Node expressions:

                stack.push(right);
                stack.push(left);
            } else if (expression.hasOwnProperty('term')) {  // Field expressions:

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
            } else { // Range Expressions:
            }

            // words[i].match(/\)$/)
            // right closing grouping parenthesis, don't add a wildcard

        }

        return this.ASTtoString(AST);
    };
};

angular.module('rnacentralApp')
    .service('luceneParser', [luceneParser]);