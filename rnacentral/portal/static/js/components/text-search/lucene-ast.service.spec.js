describe("Lucene AST:", function() {
    // inject and module functions come from angular-mocks
    beforeEach(module('textSearch'));

    describe("_preprocess():", function() {
        it("should capitalize 'AND' in 'foo and bar:baz'", inject(function(LuceneAST) {
            expect(LuceneAST._preprocess('foo and bar:baz')).toEqual('foo AND bar:baz');
        }));

        it("should capitalize 'NOT' and 'AND' in 'not foo and bar:baz'", inject(function(LuceneAST) {
            expect(LuceneAST._preprocess('not foo and bar:baz')).toEqual('NOT foo AND bar:baz');
        }));

        it("should capitalize 'TO' in '4V4Q AND length:[120 to 1029]'", inject(function(LuceneAST) {
            expect(LuceneAST._preprocess('4V4Q AND length:[120 to 1029]')).toEqual('4V4Q AND length:[120 TO 1029]');
        }));
    });

    describe("unparse():", function() {
        it("should parse and unparse node expressions with 2 child expressions", inject(function (LuceneAST) {
            var query = 'foo AND bar:baz';
            var AST = new LuceneAST(query);
            var normalizedQuery = AST.unparse();

            expect(normalizedQuery).toEqual('foo AND bar:"baz"');
        }));

        it("should parse double quotes in fields: 'expert_db:\"mirbase\"'", inject(function (LuceneAST) {
            var query = 'expert_db:"mirbase"';
            var AST = new LuceneAST(query);
            var normalizedQuery = AST.unparse();

            expect(normalizedQuery).toEqual(query);
        }));

        it("should parse range expressions: '4V4Q AND length:[120 TO 1029]'", inject(function (LuceneAST) {
            var query = '4V4Q AND length:[120 TO 1029]';
            var AST = new LuceneAST(query);
            var normalizedQuery = AST.unparse();

            expect(normalizedQuery).toEqual(query);
        }));

        it("should handle lowercase 'to' in range expressions: '4V4Q AND length:[120 to 1029]'", inject(function (LuceneAST) {
            var query = '4V4Q AND length:[120 to 1029]';
            query = query.toUpperCase().replace(/(URS[0-9A-F]{10})\/(\d+)/ig, '$1_$2');
            var AST = new LuceneAST(query);
            var normalizedQuery = AST.unparse();

            expect(normalizedQuery).toEqual(query);
        }));

        it("should handle non-binary tree: 'expert_db:\"mirbase\" OR expert_db:\"silva\" OR expert_db:\"ena\"'", inject(function (LuceneAST) {
            var query = 'expert_db:\"mirbase\" OR expert_db:\"silva\" OR expert_db:\"ena\"';
            var AST = new LuceneAST(query);
            var normalizedQuery = AST.unparse();

            expect(normalizedQuery).toEqual(query);
        }));
    });

    describe("findField():", function() {
        it("should find length field in: '4V4Q AND length:[120 TO 1029]'", inject(function (LuceneAST) {
            var query = '4V4Q AND length:[120 TO 1029]';
            var AST = new LuceneAST(query);
            var fields = AST.findField('length');

            expect(fields.length).toEqual(1);
        }));
    });


    describe("removeField():", function() {
        it("should remove length from: '4V4Q AND length:[120 TO 1029]'", inject(function (LuceneAST) {
            var query = '4V4Q AND length:[120 TO 1029]';
            var AST = new LuceneAST(query);
            AST.removeField('length');
            var normalizedQuery = AST.unparse();
            expect(normalizedQuery).toEqual('4V4Q');
        }));
    });

    describe("addField():", function() {
        it("should add 'length:[120 TO 1029]' with 'AND' operator to '4V4Q'", inject(function (LuceneAST) {
            var query = '4V4Q';
            var AST = new LuceneAST(query);

            var field = {
                'field': 'length',
                'term_min': '120',
                'term_max': '1029',
                'inclusive': true,
                'inclusive_min': true,
                'inclusive_max': true
            };
            AST.addField(field, 'AND');

            var normalizedQuery = AST.unparse();
            expect(normalizedQuery).toEqual('4V4Q AND length:[120 TO 1029]');
        }));

        it("should create sibling 'expert_db:\"ENA\"' in 'hotair AND expert_db:\"HGNC\"'", inject(function (LuceneAST) {
            var query = 'hotair AND expert_db:"HGNC"';
            var AST = new LuceneAST(query);

            var field = {
                field: 'expert_db',
                term: 'ENA',
                prefix: undefined,
                boost: undefined,
                similarity: undefined,
                proximity: undefined
            };
            var otherField = AST.findField('expert_db')[0];
            AST.addField(field, 'OR', otherField);

            var normalizedQuery = AST.unparse();
            expect(normalizedQuery).toEqual('hotair AND (expert_db:"HGNC" OR expert_db:"ENA")');
        }))
    });
});