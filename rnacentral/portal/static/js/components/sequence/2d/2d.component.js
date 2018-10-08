var secondary_structures = {
    bindings: {
        upi: '<',
        taxid: '<?',
        showSecondaryStructureTab: '&'
    },
    controller: ['$http', '$interpolate', 'routes', function($http, $interpolate, routes) {
        var ctrl = this;

        ctrl.fornaSize = 500;
        ctrl.numStructures = 0;

        ctrl.$onInit = function() {
            ctrl.fetchSecondaryStructures().then(
                function(response) {
                    ctrl.secondaryStructures = response.data.data;
                    ctrl.numStructures = ctrl.secondaryStructures.secondary_structures.length;
                    ctrl.SecondaryStructureUrl = routes.apiSecondaryStructuresView({ upi: ctrl.upi, taxid: ctrl.taxid });
                    ctrl.displayForna();
                },
                function(response) {
                    ctrl.error = "Failed to download secondary structures";
                }
            );
        };

        ctrl.fetchSecondaryStructures = function() {
            return $http.get(routes.apiSecondaryStructuresView({ upi: ctrl.upi, taxid: ctrl.taxid }),
                { timeout: 5000 }
            )
        };

        ctrl.getSourceUrl = function() {
            if (ctrl.numStructures === 0) {
                return '';
            }
            return ctrl.secondaryStructures.secondary_structures[0].source[0].url;
        };

        ctrl.displayForna = function() {
            if (ctrl.numStructures === 0) {
                return;
            }
            var container = new fornac.FornaContainer("#rna_ss", {
                'applyForce': false,
                'allowPanningAndZooming': true,
                'initialSize':[ctrl.fornaSize, ctrl.fornaSize],
            });
            var options = {
                'structure': ctrl.secondaryStructures.secondary_structures[0].secondary_structure,
                'sequence': ctrl.secondaryStructures.sequence,
            };
            container.addRNA(options.structure, options);
            ctrl.showSecondaryStructureTab();
        };

        /**
         * Saves structure in dot-bracket notation as a file, code stolen from:
         * https://stackoverflow.com/questions/3665115/create-a-file-in-memory-for-user-to-download-not-through-server
         */
        ctrl.save2D = function() {
            var filename = ctrl.upi + '.dbn';
            var blob = new Blob([ctrl.secondaryStructures.secondary_structures[0].secondary_structure], {type: 'text/plain'});
            if(window.navigator.msSaveOrOpenBlob) {
                window.navigator.msSaveBlob(blob, filename);
            }
            else{
                var elem = window.document.createElement('a');
                elem.href = window.URL.createObjectURL(blob);
                elem.download = filename;
                document.body.appendChild(elem);
                elem.click();
                document.body.removeChild(elem);
            }
        };

    }],
    template: '<div id="2d" style="min-height: 600px">' +
              '    <h2>Secondary structure</h2>'+
              '    <div class="col-md-6" ng-if="$ctrl.numStructures > 0">' +
              '      <p>' +
              '        Predicted using tRNAScan-SE 2.0 (source: <a href="{{ $ctrl.getSourceUrl() }}">GtRNAdb</a>).' +
              '      </p>' +
              '    </div>' +
              '    <div class="col-md-6" ng-if="$ctrl.numStructures > 0">' +
              '      <p>Structure in dot-bracket notation:</p>' +
              '      <pre style="white-space: pre-wrap">{{ $ctrl.secondaryStructures.secondary_structures[0].secondary_structure }}</pre>' +
              '      <button class="btn btn-primary" ng-click="$ctrl.save2D()">Download</button>' +
              '    </div>' +
              '    <div class="col-md-6" ng-if="$ctrl.numStructures === 0">' +
              '      <p>' +
              '        No secondary structures available' +
              '      </p>' +
              '    </div>' +
              '    <div id="rna_ss" style="width: {{ $ctrl.fornaSize }}px; height: {{ $ctrl.fornaSize }}px; margin-left: 9px;"></div>' +
              '</div>'
};

angular.module("rnaSequence").component("secondaryStructures", secondary_structures);
