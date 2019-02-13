"""
Copyright [2009-2019] EMBL-European Bioinformatics Institute
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at
     http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
"""

from caching.base import CachingMixin, CachingManager
from django.db import models


class EnsemblCompara(CachingMixin, models.Model):
    id = models.IntegerField(primary_key=True)
    ensembl_transcript_id = models.TextField()
    urs_taxid = models.ForeignKey(models.RnaPrecomputed, to_field='id')
    homology_id = models.IntegerField()

    objects = CachingManager()

    class Meta:
        db_table = 'ensembl_compara'
