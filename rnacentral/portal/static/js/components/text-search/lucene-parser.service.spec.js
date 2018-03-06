describe("Lucene parser:", function() {
    // inject and module functions come from angular-mocks
    beforeEach(module('textSearch'));

    describe("preprocess():", function() {
        it("should capitalize 'AND' in 'foo and bar:baz'", inject(function(luceneParser) {
            expect(luceneParser._preprocess('foo and bar:baz')).toEqual('foo AND bar:baz');
        }));

        it("should capitalize 'NOT' and 'AND' in 'not foo and bar:baz'", inject(function(luceneParser) {
            expect(luceneParser._preprocess('not foo and bar:baz')).toEqual('NOT foo AND bar:baz');
        }));

        it("should capitalize 'TO' in '4V4Q AND length:[120 to 1029]'", inject(function(luceneParser) {
            expect(luceneParser._preprocess('4V4Q AND length:[120 to 1029]')).toEqual('4V4Q AND length:[120 TO 1029]');
        }));
    });

    describe("unparse():", function() {
        it("should parse and unparse node expressions with 2 child expressions", inject(function (luceneParser) {
            var query = 'foo AND bar:baz';
            var AST = luceneParser.parse(query);
            var normalizedQuery = luceneParser.unparse(AST);

            expect(normalizedQuery).toEqual('foo AND bar:"baz"');
        }));

        it("should parse double quotes in fields: 'expert_db:\"mirbase\"'", inject(function (luceneParser) {
            var query = 'expert_db:"mirbase"';
            var AST = luceneParser.parse(query);
            var normalizedQuery = luceneParser.unparse(AST);

            expect(normalizedQuery).toEqual(query);
        }));

        it("should parse range expressions: '4V4Q AND length:[120 TO 1029]'", inject(function (luceneParser) {
            var query = '4V4Q AND length:[120 TO 1029]';
            var AST = luceneParser.parse(query);
            var normalizedQuery = luceneParser.unparse(AST);

            expect(normalizedQuery).toEqual(query);
        }));

        it("should handle lowercase 'to' in range expressions: '4V4Q AND length:[120 to 1029]'", inject(function (luceneParser) {
            var query = '4V4Q AND length:[120 to 1029]';
            query = query.toUpperCase().replace(/(URS[0-9A-F]{10})\/(\d+)/ig, '$1_$2');
            var AST = luceneParser.parse(query);
            var normalizedQuery = luceneParser.unparse(AST);

            expect(normalizedQuery).toEqual(query);
        }));
    });

    describe("findField():", function() {

    });

    describe("removeField():", function() {
       it("should remove length from: '4V4Q AND length:[120 TO 1065]'", inject(function (luceneParser) {
            var query = '4V4Q AND length:[120 TO 1029]';
            var AST = luceneParser.parse(query);
            AST = luceneParser.ASTWithParents(AST);
            luceneParser.removeField('length', AST);

            var normalizedQuery = luceneParser.unparse(AST);
            expect(normalizedQuery).toEqual('4V4Q');
       }));
    });
});