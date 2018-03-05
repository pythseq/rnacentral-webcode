describe("Lucene query parser spec", function() {
    // inject and module functions come from angular-mocks
    beforeEach(module('textSearch'));
    it("Should parse and unparse node expressions with 2 child expressions", inject(function(luceneParser) {
        var query = 'foo AND bar:baz';
        var AST = luceneParser.parse(query);
        var normalizedQuery = luceneParser.unparse(AST);

        expect(normalizedQuery).toEqual('foo AND bar:"baz"');
    }));

    it ("Should parse double quotes in fields: 'expert_db:\"mirbase\"'", inject(function(luceneParser) {
        var query = 'expert_db:"mirbase"';
        var AST = luceneParser.parse(query);
        var normalizedQuery = luceneParser.unparse(AST);

        expect(normalizedQuery).toEqual(query);
    }));

    fit("Should parse range expressions: '4V4Q AND length:[120 TO 1029]'", inject(function(luceneParser) {
        var query = '4V4Q AND length:[120 TO 1029]';
        var AST = luceneParser.parse(query);
        var normalizedQuery = luceneParser.unparse(AST);

        expect(normalizedQuery).toEqual(query);
    }));

    it("Should handle lowercase 'to' in range expressions: '4V4Q AND length:[120 to 1029]'", inject(function(luceneParser) {
        var query = '4V4Q AND length:[120 to 1029]';
        var AST = luceneParser.parse(query);
        var normalizedQuery = luceneParser.unparse(AST);

        expect(normalizedQuery).toEqual(query);
    }));

});