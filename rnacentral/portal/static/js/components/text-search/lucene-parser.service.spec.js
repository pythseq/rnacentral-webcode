describe("Lucene query parser spec", function() {
    // inject and module functions come from angular-mocks
    beforeEach(module('textSearch'));
    it("Should parse and unparse", inject(function(luceneParser) {
        var query = 'foo AND bar:baz';
        var AST = luceneParser.parse(query);
        var normalizedQuery = luceneParser.unparse(AST);

        expect(normalizedQuery).toEqual('foo AND bar:"baz"');
    }));

    it ("Should parse/unparse 'expert_db:\"mirbase\"'", inject(function(luceneParser) {
        var query = 'expert_db:"mirbase"';
        var AST = luceneParser.parse(query);
        var normalizedQuery = luceneParser.unparse(AST);

        expect(normalizedQuery).toEqual(query);
    }));
});