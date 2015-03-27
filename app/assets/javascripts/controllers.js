var Prometheus = Prometheus || {},
    dashboardData = dashboardData || {},
    servers;

Prometheus.Graph = {
  rangeSteps: [
    '1s', '10s', '1m', '5m', '15m', '30m', '1h', '2h', '6h', '12h', '1d', '2d',
    '1w', '2w', '4w', '8w', '1y', '2y'
  ],

  timeFactors: {
    'y': 60 * 60 * 24 * 365,
    'w': 60 * 60 * 24 * 7,
    'd': 60 * 60 * 24,
    'h': 60 * 60,
    'm': 60,
    's': 1
  },

  durationToString: function(seconds) {
    var factors = {
      "y": 60 * 60 * 24 * 365,
      "d": 60 * 60 * 24,
      "h": 60 * 60,
      "m": 60,
      "s": 1
    };
    var unit = "s";
    for (var i in factors) {
      if (seconds % factors[i] === 0) {
        unit = i;
        break;
      }
    }
    return seconds/factors[unit] + unit;
  },

  parseDuration: function(durationText) {
    if (!durationText) {
      return 60;
    }
    var rangeRE = new RegExp('^([0-9]+)([ywdhms]+)$');
    var matches = durationText.match(rangeRE);
    if (!matches) {
      return;
    }
    if (matches.length != 3) {
      return 60;
    }
    var value = parseInt(matches[1]);
    var unit = matches[2];
    return value * Prometheus.Graph.timeFactors[unit];
  },

  nextLongerRange: function(currentRange) {
    if (!currentRange) {
      return '1h';
    }
    var rangeSeconds = Prometheus.Graph.parseDuration(currentRange);
    for (var i = 0; i < Prometheus.Graph.rangeSteps.length; i++) {
      if (rangeSeconds < Prometheus.Graph.parseDuration(Prometheus.Graph.rangeSteps[i])) {
        return Prometheus.Graph.rangeSteps[i];
      }
    }
    return currentRange;
  },

  nextShorterRange: function(currentRange) {
    if (!currentRange) {
      return '1h';
    }
    var rangeSeconds = Prometheus.Graph.parseDuration(currentRange);
    for (var i = Prometheus.Graph.rangeSteps.length - 1; i >= 0; i--) {
      if (rangeSeconds > Prometheus.Graph.parseDuration(Prometheus.Graph.rangeSteps[i])) {
        return Prometheus.Graph.rangeSteps[i];
      }
    }
    return currentRange;
  },

  earlierEndTime: function(timestamp, rangeText) {
    var range = Prometheus.Graph.parseDuration(rangeText);
    var date = timestamp ? new Date(timestamp) : new Date();
    return Math.floor(date.getTime() - (range * 1000 / 2));
  },

  laterEndTime: function(timestamp, rangeText) {
    var range = Prometheus.Graph.parseDuration(rangeText);
    var date = timestamp ? new Date(timestamp) : new Date();
    return Math.floor(date.getTime() + (range * 1000 / 2));
  },

  getAxisDefaults: function() {
    return {
      orientation: 'left',
      renderer: 'line',
      scale: 'linear',
      format: 'kmbt'
    };
  }
};

Prometheus.Graph.Gauge = function(args) {
  if (!args.element) {
    throw "Prometheus.Graph.Gauge needs a reference to an element";
  }
  if (!args.value) {
    throw "Prometheus.Graph.Gauge needs a value";
  }
  if (!args.max) {
    throw "Prometheus.Graph.Gauge needs a max";
  }
  var defaults = {
    width:     args.element.clientWidth,
    height:    args.element.clientHeight,
    value:     args.value,
    max:       args.max,
    danger:    0.75,
    warning:   0.50,
    precision: 2,
    bgColor:   "#666",
    textColor: "#fff",
  };

  this.element = args.element;
  this.svg = d3.select(this.element).append("svg");
  this.width = args.width || defaults.width;
  this.height = args.height || defaults.height;

  this.value = args.value || defaults.value;
  this.units = args.units;

  this.max = args.max || defaults.max;
  this.thickness = args.thickness || this.width/15;
  this.precision = args.precision || this.precision;

  this.danger = args.danger || defaults.danger;
  this.warning = args.warning || defaults.warning;
  this.bgColor = args.bgColor || defaults.bgColor;
  this.textColor = args.textColor || defaults.textColor;
};

Prometheus.Graph.Gauge.prototype.render = function() {
  var pi = Math.PI;
  var translate = "translate(" + this.width/2 + "," + this.height + ")";
  var start = -0.5 * pi;
  var fullGaugeWidth = start + pi;
  var percentage = this.value / this.max;
  var end = (percentage * pi) - fullGaugeWidth;
  if (this.value > this.max) {
    end = fullGaugeWidth;
  }

  var d = this.width/2;
  if (this.height < d) {
    d = this.height;
  }
  var outerRadius = d;
  var innerRadius = outerRadius - this.thickness;

  // Gauge container.
  var container = d3.svg.arc()
                        .innerRadius(innerRadius)
                        .outerRadius(outerRadius)
                        .startAngle(start)
                        .endAngle(fullGaugeWidth);

  this.svg.attr("width", this.width)
          .attr("height", this.height)
          .append("path")
          .attr("d", container)
          .attr("fill", this.bgColor)
          .attr("transform", translate);

  // The current value of the gauge.
  var arc = d3.svg.arc()
                  .innerRadius(innerRadius)
                  .outerRadius(outerRadius)
                  .startAngle(start)
                  .endAngle(end);

  this.svg.attr("width", this.width)
          .attr("height", this.height)
          .append("path")
          .attr("d", arc)
          .attr("fill", function(d) {
            if (percentage > this.danger) {
              return "red";
            } else if (percentage > this.warning) {
              return "yellow";
            }
            return "green";
          }.bind(this))
          .attr("transform", translate);

  // The label for the gauge.
  this.svg.selectAll("text")
          .data([{value: this.value, units: this.units}])
          .enter()
          .append("text")
          .attr("x", this.width/2)
          .style("text-anchor", "middle")
          .attr("y", this.height*0.95)
          .text(function(d) {
            return d.value.toFixed(this.precision) + " " + (d.units || "");
          }.bind(this))
          .attr("font-size", this.width/20 + "px")
          .attr("fill", this.textColor);
};
