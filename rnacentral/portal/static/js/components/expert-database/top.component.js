var top = {
    bindings: {
        expertDb: "<"
    },
    template: '<h1>' +
              '  <a href="{{ $ctrl.expertDb.url }}" target="_blank" class="expert-db-logo no-icon">' +
              '    <img src="{{ $ctrl.routes[] }}" alt="{{ $ctrl.expertDb.name }} logo" class="img-rounded">' +
              '  </a>' +
              '  {{ $ctrl.expertDb.name }} Expert Database' +
              '    <small ng-if="$ctrl.expertDb.status != \'archived\'"><label class="label label-primary">{{ $ctrl.expertDb.status }}</label></small>' +
              '    <small ng-if="$ctrl.expertDb.status == \'archived\'"><label class="label label-danger">{{ $ctrl.expertDb.status }}</label></small>' +
              '</h1>' +
              '' +
              '<div class="row">' +
              '  <div class="col-md-12">' +
              '    <p>' +
              '      <a href="{{ $ctrl.expertDb.url }}" target="_blank">{{ $ctrl.expertDb.name }}</a>' +
              '      <span ng-if="$ctrl.expertDb.abbreviation">({{ $ctrl.expertDb.abbreviation }})</span>' +
              '      {{ $ctrl.expertDb.description }}.' +
              '    </p>' +
              '  </div>' +
              '</div>',
    controller: ['$interpolate', '$location', '$http', 'search', 'routes', function($interpolate, $location, $http, search, routes) {
        var ctrl = this;

        ctrl.$onInit = function() {
            // urls used in template (hardcoded)
            ctrl.routes = routes;

            // TODO: route to expert-db-logos!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
            // expert-db-logos {% static 'img/expert-db-logos/' %}{{expert_db.label}}.png
        };
    }]
};

angular.module('expertDatabase').component('top', top);