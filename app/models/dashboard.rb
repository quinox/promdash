require 'slug_maker'

class DashboardJSONValidator < ActiveModel::Validator
  def validate(record)
    return
    return unless record.dashboard_json
    errors = JSON::Validator.fully_validate('dashboard_schema.json', record.dashboard_json, :validate_schema => true)
    if !errors.empty?
      errors.each do |e|
        record.errors[:dashboard_json] << e
      end
    end
  end
end

class Dashboard < ActiveRecord::Base
  belongs_to :directory
  has_many :shortened_urls

  validates :name, uniqueness: { case_sensitive: false }
  validates :name, :slug, presence: true
  validate :acceptable_slug
  validates :slug,
    format: {
      with: /\A[a-z0-9\-]+\z/,
      message: "Only alphanumeric characters connected by hyphens are allowed."
    }
  validates_with DashboardJSONValidator

  scope :alphabetical, -> { order("lower(name)") }
  scope :cloneable, -> { where("dashboard_json is not null").select :id, :name }
  scope :unassigned, -> { where("directory_id is null") }

  def self.new_with_slug(params)
    dashboard = new(params)
    dashboard.create_slug
    dashboard
  end

  def self.new_permalink(params)
    params[:name] = "#{params[:name]} #{Time.now.utc.to_s}"
    d = new_with_slug(params)
    d.permalink = true
    d
  end

  def make_clone
    clone = dup
    clone.name = "#{name} clone"
    clone
  end

  def acceptable_slug
    if black_listed_slug_names.include? slug
      errors.add(:slug, "Reserved name")
    end
  end

  def black_listed_slug_names
    %w(dashboard servers about help signin signout home contact assets w annotations)
  end

  def widgets
    return [] unless dashboard_json
    (JSON.parse dashboard_json)['widgets']
  end

  def create_slug
    self.slug = SlugMaker.slug(name)
  end
end
