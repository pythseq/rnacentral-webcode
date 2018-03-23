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

/**
 * Creates a new Abstract Syntax Tree (AST) from lucene query.
 * AST consists of 3 types of expressions:
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
 * @constructor
 */
var LuceneAST = function(query) {
    query = LuceneAST._preprocess(query);
    var ast = lucenequeryparser.parse(query);
    _.extend(this, ast);
    this.findParents();
};


/**
 * Enum of expressions, allowed in AST.
 * @type {{NODE: string, FIELD: string, RANGE: string}}
 * @const
 */
LuceneAST.TYPES = {'NODE': 'NODE', 'FIELD': 'FIELD', 'RANGE': 'RANGE', 'EMPTY': 'EMPTY'};


/**
 * Checks, if search query contains any lucene-specific syntax, or if it's a plain text
 * @param {string} query
 * @returns {boolean} true, if it's a complex lucene expression, false - if it's just a plaintext search
 */
LuceneAST.luceneSyntaxUsed = function(query) {
    var AST = new LuceneAST(query);
    return (!AST.hasOwnProperty('right') && AST.left.field == '<implicit>');
};


/**
 * Helper that determines, if given expression is a node, field or range expression.
 * @param expression - a single expression from AST
 * @returns {string} - one of 'node', 'field' or 'range'
 * @private
 */
LuceneAST._type = function(expression) {
    if (expression.hasOwnProperty('left')) return LuceneAST.TYPES.NODE;
    else if (expression.hasOwnProperty('term')) return LuceneAST.TYPES.FIELD;
    else if (expression.hasOwnProperty('term_min')) return LuceneAST.TYPES.RANGE;
    else if (Object.keys(expression).length === 1) return LuceneAST.TYPES.EMPTY;
    else throw "AST expression of unknown type: " + JSON.stringify(expression);
};


/**
 * Capitalize lucene AND/OR/NOT/TO words, replace slashes with underscores
 * @param query
 * @private
 */
LuceneAST._preprocess = function (query) {
    if (query.match(/[^\s"]+|"[^"]*"/g)) {
        return query.match(/[^\s"]+|"[^"]*"/g) // split into words: http://stackoverflow.com/questions/366202/regex-for-splitting-a-string-using-space-when-not-surrounded-by-single-or-double
                    .map(function(word) { return word.match(/^(and|or|not|to)$/gi) ? word.toUpperCase() : word }) // capitalize AND, OR, NOT and TO
                    .reduce(function(query, word) { return query + " " + word }) // join words
                    .replace(/: /g, ':') // avoid spaces after faceted search terms
                    .replace(/(URS[0-9A-F]{10})\/(\d+)/ig, '$1_$2'); // replace slashes with underscores
    } else {
        return query;
    }
};


/**
 * Escape special symbols used by Lucene
 * Escaped: + - && || ! { } [ ] ^ ~ ? : \ /
 * Not escaped: * " ( ) because they may be used deliberately by the user
 * @private
 */
LuceneAST._escape = function (searchTerm) {
    return searchTerm.replace(/[\+\-&|!\{\}\[\]\^~\?\:\\\/]/g, "\\$&");
};


// Prototype methods
// -----------------

/**
 * Adds parent property to each AST element that points to its parent
 * node element.
 */
LuceneAST.prototype.findParents = function() {
    this.parent = null; // root's parent is null

    var top, stack = [this];
    while (stack.length > 0) {
        top = stack.shift(); // add 'parent' to children of top, if top has children
        if (LuceneAST._type(top) === LuceneAST.TYPES.NODE) {
            if (top.hasOwnProperty('left')) {
                stack.unshift(top.left);
                top.left.parent = top;
            }


            if (top.hasOwnProperty('right')) {
                stack.unshift(top.right);
                top.right.parent = top;
            }
        }
    }
};


/**
 * Inverse to parsing - assemble a query string back from AST
 * @returns {string} - Lucene query string
 */
LuceneAST.prototype.unparse = function() {
    var result = "";
    var stack = [this]; // stack maintained for DFS

    var expression; // expression is the currently evaluated
    while (stack.length > 0) {
        // we're using shift/unshift instead of push/pop in order to avoid reversing arguments order
        expression = stack.shift();

        if (typeof expression == 'string') {
            result = result + expression;
        } else if (LuceneAST._type(expression) === LuceneAST.TYPES.NODE) {
            if (expression.hasOwnProperty('right')) {
                if (expression === this) stack.unshift(expression.left, ' ', expression.operator, ' ', expression.right);
                else stack.unshift('(', expression.left, ' ', expression.operator, ' ', expression.right, ')');
            } else {
                stack.unshift(expression.left);
            }
        } else if (LuceneAST._type(expression) === LuceneAST.TYPES.FIELD) {
            var prefix = expression.prefix ? expression.prefix : '';
            if (expression.field === '<implicit>') result += prefix + expression.term;
            else {
                if (['pubmed', 'doi', 'taxonomy'].indexOf(expression.field) !== -1 ) {
                    expression.term = expression.term.toUpperCase();
                }

                result += expression.field + ':' + prefix + '"' + expression.term + '"';
            }
        } else if (LuceneAST._type(expression) === LuceneAST.TYPES.RANGE) {
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
 * Returns all occurrences of a named field with a certain term in left-to-right order.
 * @param {string} field
 * @param {string|object} [term] - string for FIELD expressions, object {} for RANGE expressions,
 *   if undefined, check for equality of terms is not performed
 * @returns {Array} - array of found expression objects
 */
LuceneAST.prototype.findField = function(field, term) {
    var top; // top of the stack
    var stack = [this];
    var results = [];
    while (stack.length > 0) {
        top = stack.shift();
        if (LuceneAST._type(top) === LuceneAST.TYPES.FIELD) {
            if (top.field === field) {
                if (typeof(term) === 'undefined') results.push(top);
                else if (top.term && top.term.toUpperCase() === term.toUpperCase()) results.push(top);
            }
        } else if (LuceneAST._type(top) === LuceneAST.TYPES.RANGE) {
            if (typeof(term) === 'undefined') results.push(top);
            else if (top.field === field &&
                top.term_min === term.term_min &&
                top.term_max === term.term_max &&
                top.inclusive_min === term.inclusive_min &&
                top.inclusive_max === term.inclusive_max) results.push(top);
        } else if (LuceneAST._type(top) === LuceneAST.TYPES.NODE) {
            if (top.hasOwnProperty('right')) stack.unshift(top.right);
            stack.unshift(top.left);
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
LuceneAST.prototype.removeField = function(field, term) {
    var self = this;
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
 * If otherField is undefined, adds a field to the top of the AST (so that
 * it becomes the last part of lucene query) with operator (usually, 'AND').
 *
 * If otherField is defined, adds the field as a sibling of otherField
 * (usually with 'OR' operator).
 *
 * @param {object} field - FIELD or RANGE expression
 * @param {string} operator - e.g. 'AND', 'OR'
 * @param {object} [otherField] - FIELD, RANGE or NODE expression
 * @returns {object} newAST
 */
LuceneAST.prototype.addField = function(field, operator, otherField) {
    // If otherField not set, just append new field to the end of the query
    if (typeof otherField === 'undefined') {
        var left = _.extend({}, this); // create a shallow copy of AST
        Object.keys(this).forEach(function(key) { delete this[key] }); // clean old properties from AST

        this.left = left;
        this.operator = operator;
        this.right = field;

        this.left.parent = this;
        this.parent = null;
    } else { // otherField is set - make new field its sibling
        var newNode, parent = otherField.parent !== null ? otherField.parent : null;

        if (parent === null) {  // this node was the root of the tree, handle special case
            // make newNode behave as if it were the old root and it was made a child of new root
            newNode = {
                left: otherField.left,
                operator: otherField.operator,
                right: otherField.right,
                field: undefined
            };

            Object.keys(this).forEach(function(key) { delete this[key]; });

            this.left = newNode;
            this.right = field;
            this.operator = operator;
            this.field = null;
            this.parent = null;
        } else { // newNode is not the root
            newNode = {
                left: otherField,
                operator: operator,
                right: field,
                field: undefined
            };

            // replace otherField with newNode in tree hierarchy, make field and otherField newNode children
            newNode.parent = parent;
            otherField.parent = newNode;
            field.parent = newNode;

            if (parent && parent.left === otherField) parent.left = newNode;
            else if (parent) parent.right = newNode;
        }
    }
};


angular.module('textSearch')
    .service('LuceneAST', [function() { return LuceneAST; }]);