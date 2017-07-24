"""
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

Quick reference:
CharField - regular model field
Field - model method call
SerializerMethodField - serializer method call
HyperlinkedIdentityField - link to a view

"""

from django.core.paginator import Paginator
from rest_framework import serializers
from rest_framework import pagination

from portal.models import Rna, Xref, Reference, Database, Accession, Release, Reference, Reference_map, Modification, ChemicalComponent


class RawCitationSerializer(serializers.ModelSerializer):
    """Serializer class for literature citations. Used in conjunction with raw querysets."""
    authors = serializers.CharField(source='get_authors_list')
    publication = serializers.CharField(source='location')
    pubmed_id = serializers.CharField(source='pubmed')
    doi = serializers.CharField(source='doi')
    title = serializers.Field(source='get_title')
    pub_id = serializers.Field(source='id')

    class Meta:
        model = Reference
        fields = ('title', 'authors', 'publication', 'pubmed_id', 'doi', 'pub_id')


class CitationSerializer(serializers.HyperlinkedModelSerializer):
    """Serializer class for literature citations."""
    authors = serializers.CharField(source='data.get_authors_list')
    publication = serializers.CharField(source='data.location')
    pubmed_id = serializers.CharField(source='data.pubmed')
    doi = serializers.CharField(source='data.doi')
    title = serializers.Field(source='data.get_title')
    pub_id = serializers.Field(source='data.id')

    class Meta:
        model = Reference_map
        fields = ('title', 'authors', 'publication', 'pubmed_id', 'doi', 'pub_id')


class AccessionSerializer(serializers.HyperlinkedModelSerializer):
    """Serializer class for individual cross-references."""
    id = serializers.CharField(source='accession')
    citations = serializers.HyperlinkedIdentityField(view_name='accession-citations')
    source_url = serializers.Field(source='get_ena_url')
    rna_type = serializers.Field(source='get_rna_type')
    expert_db_url = serializers.Field(source='get_expert_db_external_url')

    # database-specific fields
    pdb_entity_id = serializers.Field(source='get_pdb_entity_id')
    pdb_structured_note = serializers.Field(source='get_pdb_structured_note')
    hgnc_enembl_id = serializers.Field(source='get_hgnc_ensembl_id')
    hgnc_id = serializers.Field(source='get_hgnc_id')
    biotype = serializers.Field(source='get_biotype')
    rna_type = serializers.Field(source='get_rna_type')
    srpdb_id = serializers.Field(source='get_srpdb_id')
    ena_url = serializers.Field(source='get_ena_url')
    vega_transcript_url = serializers.Field(source='get_vega_transcript_url')
    gencode_transcript_id = serializers.Field(source='get_gencode_transcript_id')
    gencode_ensembl_url = serializers.Field(source='get_gencode_ensembl_url')
    ensembl_species_url = serializers.Field(source='get_ensembl_species_url')

    class Meta:
        model = Accession
        fields = (
            'url', 'id', 'parent_ac', 'seq_version', 'description', 'external_id', 'optional_id',
            'species', 'rna_type', 'gene', 'product', 'organelle',
            'citations', 'source_url', 'expert_db_url',
            'pdb_entity_id', 'pdb_structured_note', 'hgnc_enembl_id', 'hgnc_id',
            'biotype', 'rna_type', 'srpdb_id', 'ena_url',
            'vega_transcript_url', 'gencode_transcript_id',
            'gencode_ensembl_url', 'ensembl_species_url'
        )


class ChemicalComponentSerializer(serializers.ModelSerializer):
    """Django Rest Framework serializer class for chemical components."""
    id = serializers.CharField()
    description = serializers.CharField()
    one_letter_code = serializers.CharField()
    ccd_id = serializers.CharField()
    source = serializers.CharField()
    modomics_short_name = serializers.CharField()
    pdb_url = serializers.Field(source='get_pdb_url')
    modomics_url = serializers.Field(source='get_modomics_url')

    class Meta:
        model = ChemicalComponent


class ModificationSerializer(serializers.ModelSerializer):
    """Django Rest Framework serializer class for modified positions."""
    position = serializers.IntegerField()
    author_assigned_position = serializers.IntegerField()
    chem_comp = ChemicalComponentSerializer(source='modification_id')

    class Meta:
        model = Modification


class XrefSerializer(serializers.HyperlinkedModelSerializer):
    """Serializer class for all cross-references associated with an RNAcentral id."""
    database = serializers.CharField(source='db.display_name')
    is_expert_db = serializers.SerializerMethodField('is_expert_xref')
    is_active = serializers.Field('is_active')
    first_seen = serializers.CharField(source='created.release_date')
    last_seen = serializers.CharField(source='last.release_date')
    accession = AccessionSerializer()

    # database-specific fields
    modifications = ModificationSerializer(many=True)
    is_rfam_seed = serializers.Field(source='is_rfam_seed')
    ncbi_gene_id = serializers.Field(source='get_ncbi_gene_id')
    ndb_external_url = serializers.Field(source='get_ndb_external_url')
    mirbase_mature_products = serializers.Field(source='get_mirbase_mature_products_if_any')
    mirbase_precursor = serializers.Field(source='get_mirbase_precursor')
    refseq_mirna_mature_products = serializers.Field(source='get_refseq_mirna_mature_products_if_any')
    refseq_mirna_precursor = serializers.Field(source='get_refseq_mirna_precursor')
    refseq_splice_variants = serializers.Field(source='get_refseq_splice_variants')
    vega_splice_variants = serializers.Field(source='get_vega_splice_variants')
    tmrna_mate_upi = serializers.Field(source='get_tmrna_mate_upi')
    tmrna_type = serializers.Field(source='get_tmrna_type')
    ensembl_division = serializers.Field(source='get_ensembl_division')
    ucsc_db_id = serializers.Field(source='get_ucsc_db_id')
    genomic_coordinates = serializers.Field(source='get_genomic_coordinates_if_any')

    def is_expert_xref(self, obj):
        return True if obj.accession.non_coding_id else False

    class Meta:
        model = Xref
        fields = (
            'database', 'is_expert_db', 'is_active', 'first_seen', 'last_seen', 'taxid', 'accession',
            'modifications', 'is_rfam_seed', 'ncbi_gene_id', 'ndb_external_url',
            'mirbase_mature_products', 'mirbase_precursor',
            'refseq_mirna_mature_products', 'refseq_mirna_precursor',
            'refseq_splice_variants', 'vega_splice_variants',
            'tmrna_mate_upi', 'tmrna_type',
            'ensembl_division', 'ucsc_db_id',
            'genomic_coordinates'
        )


class PaginatedXrefSerializer(pagination.PaginationSerializer):
    """Paginated version of XrefSerializer."""
    class Meta:
        object_serializer_class = XrefSerializer


class RnaNestedSerializer(serializers.HyperlinkedModelSerializer):
    """Serializer class for a unique RNAcentral sequence."""
    sequence = serializers.Field(source='get_sequence')
    xrefs = serializers.HyperlinkedIdentityField(view_name='rna-xrefs')
    publications = serializers.HyperlinkedIdentityField(view_name='rna-publications')
    rnacentral_id = serializers.CharField(source='upi')
    is_active = serializers.Field(source='is_active')
    description = serializers.Field(source='get_description')
    rna_type = serializers.Field(source='get_rna_type')

    class Meta:
        model = Rna
        fields = (
            'url', 'rnacentral_id', 'md5', 'sequence', 'length', 'xrefs',
            'publications', 'is_active', 'description', 'rna_type'
        )


class RnaSpeciesSpecificSerializer(serializers.HyperlinkedModelSerializer):
    """
    Serializer class for species-specific RNAcentral ids.

    Requires context['xrefs'] and context['taxid'].
    """
    sequence = serializers.Field(source='get_sequence')
    rnacentral_id = serializers.SerializerMethodField('get_species_specific_id')
    description = serializers.SerializerMethodField('get_species_specific_description')
    species = serializers.SerializerMethodField('get_species_name')
    genes = serializers.SerializerMethodField('get_genes')
    ncrna_types = serializers.SerializerMethodField('get_ncrna_types')
    taxid = serializers.SerializerMethodField('get_taxid')
    is_active = serializers.SerializerMethodField('is_active_id')

    def is_active_id(self, obj):
        """Return false if all xrefs with this taxid are inactive."""
        return bool(self.context['xrefs'].filter(deleted='N').count())

    def get_species_specific_id(self, obj):
        """Return a species-specific id using the underscore (used by Protein2GO)."""
        return obj.upi + '_' + self.context['taxid']

    def get_species_specific_description(self, obj):
        """Get species-specific description of the RNA sequence."""
        return obj.get_description(self.context['taxid'])

    def get_species_name(self, obj):
        """Get the name of the species based on taxid."""
        return self.context['xrefs'].first().accession.species

    def get_genes(self, obj):
        """Get a species-specific list of genes associated with the sequence in this particular sequence."""
        return self.context['xrefs'].values_list('accession__gene', flat=True)\
                                    .filter(accession__gene__isnull=False)\
                                    .distinct()

    def get_ncrna_types(self, obj):
        """
        Get a combined list of ncRNA types from the feature names
        and expand ncRNA feature type using ncRNA class info.
        """
        xrefs = self.context['xrefs']
        feature_names = xrefs.values_list('accession__feature_name', flat=True).distinct()

        if 'ncRNA' in feature_names:
            ncrna_classes = xrefs.values_list('accession__ncrna_class', flat=True)\
                                 .filter(accession__ncrna_class__isnull=False)\
                                 .distinct()
            ncrna_types = set(list(feature_names) + list(ncrna_classes))
            ncrna_types.discard('ncRNA')
        else:
            ncrna_types = list(feature_names)
        return ncrna_types

    def get_taxid(self, obj):
        return int(self.context['taxid'])

    class Meta:
        model = Rna
        fields = ('rnacentral_id', 'sequence', 'length', 'description',
                  'species', 'taxid', 'genes', 'ncrna_types', 'is_active')


class RnaFlatSerializer(RnaNestedSerializer):
    """Override the xrefs field in the default nested serializer to provide a flat representation."""
    xrefs = serializers.SerializerMethodField('paginated_xrefs')

    def paginated_xrefs(self, obj):
        """Include paginated xrefs."""
        queryset = obj.xrefs.all()
        page = self.context.get('page', 1)
        page_size = self.context.get('page_size', 100)
        paginator = Paginator(queryset, page_size)
        xrefs = paginator.page(page)
        serializer = PaginatedXrefSerializer(xrefs, context=self.context)
        return serializer.data


class RnaFastaSerializer(serializers.ModelSerializer):
    """Serializer for presenting RNA sequences in FASTA format"""
    fasta = serializers.Field(source='get_sequence_fasta')

    class Meta:
        model = Rna
        fields = ('fasta',)


class RnaGffSerializer(serializers.ModelSerializer):
    """Serializer for presenting genomic coordinates in GFF format"""
    gff = serializers.Field(source='get_gff')

    class Meta:
        model = Rna
        fields = ('gff',)


class RnaGff3Serializer(serializers.ModelSerializer):
    """Serializer for presenting genomic coordinates in GFF format"""
    gff3 = serializers.Field(source='get_gff3')

    class Meta:
        model = Rna
        fields = ('gff3',)


class RnaBedSerializer(serializers.ModelSerializer):
    """Serializer for presenting genomic coordinates in UCSC BED format"""
    bed = serializers.Field(source='get_ucsc_bed')

    class Meta:
        model = Rna
        fields = ('bed',)
