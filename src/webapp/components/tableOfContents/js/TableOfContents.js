/*
Copyright 2009 University of Cambridge
Copyright 2009 University of Toronto

Licensed under the Educational Community License (ECL), Version 2.0 or the New
BSD license. You may not use this file except in compliance with one these
Licenses.

You may obtain a copy of the ECL 2.0 License and BSD License at
https://github.com/fluid-project/infusion/raw/master/Infusion-LICENSE.txt
*/

// Declare dependencies
/*global fluid_1_4:true, jQuery*/

// JSLint options 
/*jslint white: true, funcinvoke: true, undef: true, newcap: true, nomen: true, regexp: true, bitwise: true, browser: true, forin: true, maxerr: 100, indent: 4 */

var fluid_1_4 = fluid_1_4 || {};

(function ($, fluid) {
    
    /******
    * ToC *
    *******/
    fluid.registerNamespace("fluid.tableOfContents");
    
    fluid.tableOfContents.insertAnchor = function (name, element) {
        $("<a></a>", {
            name: name,
            id: name
        }).insertBefore(element);
    };
    
    fluid.tableOfContents.generateGUID = function (baseName) {
        return "toc_" + baseName + "_" + fluid.allocateGuid();
    };
    
    fluid.tableOfContents.sanitizeID = function (id) {
        return id.replace(/\W/g, "-");
    };
    
    fluid.tableOfContents.finalInit = function (that) {
        var headings = that.locate("headings");
        
        that.headingTextToAnchor = function (heading) {
            var baseName = $(heading).text();
            var guid = that.sanitizeID(that.generateGUID(baseName));
            
            var anchorInfo = {
                id: guid,
                url: "#" + guid
            };
            
            that.insertAnchor(anchorInfo.id, heading);
            return anchorInfo;
        };
        
        that.anchorInfo = fluid.transform(headings, function (heading) {
            return that.headingTextToAnchor(heading);
        });
        
        // TODO: is it weird to have hide and show on a component?
        that.hide = function () {
            if (that.tocContainer) {
                that.tocContainer.hide();
            }
        };
        
        that.show = function () {
            if (that.tocContainer) {
                that.tocContainer.show();
            }
        };
        
        that.model = that.modelBuilder.assembleModel(headings, that.anchorInfo);
        that.events.onReady.fire();
    };
    
    
    fluid.defaults("fluid.tableOfContents", {
        gradeNames: ["fluid.viewComponent", "autoInit"],
        finalInitFunction: "fluid.tableOfContents.finalInit",
        components: {
            levels: {
                type: "fluid.tableOfContents.levels",
                container: "{tableOfContents}.dom.tocContainer",
                createOnEvent: "onReady",
                options: {
                    model: {
                        headings: "{tableOfContents}.model"
                    }, 
                    events: {
                        afterRender: "{tableOfContents}.events.afterRender"
                    }
                }
            },
            modelBuilder: {
                type: "fluid.tableOfContents.modelBuilder"
            }
        },
        invokers: {
            insertAnchor: "fluid.tableOfContents.insertAnchor",
            generateGUID: "fluid.tableOfContents.generateGUID",
            sanitizeID: "fluid.tableOfContents.sanitizeID"
        },
        selectors: {
            headings: ":header",
            tocContainer: ".flc-toc-tocContainer"
        },
        events: {
            onReady: null,
            afterRender: null
        }
    });
    
    
    /*******************
    * ToC ModelBuilder *
    ********************/
    fluid.registerNamespace("fluid.tableOfContents.modelBuilder");
    
    fluid.tableOfContents.modelBuilder.toModel = function (headingInfo) {
        var headings = fluid.copy(headingInfo);
        
        var buildModelLevel = function (headings, level) {
            var modelLevel = [];
            
            while (headings.length > 0) {
                var heading = headings[0];
                if (heading.level < level) {
                    break;
                }
                
                if (heading.level > level) {
                    var subHeadings = buildModelLevel(headings, level + 1);
                    
                    if (modelLevel.length > 0) {
                        modelLevel[modelLevel.length - 1].headings = subHeadings;
                    } else {
                        modelLevel.push({headings: subHeadings});
                    }
                }
                
                if (heading.level === level) {
                    modelLevel.push(heading);
                    headings.shift();
                }
            }
            
            return modelLevel;
        };
        
        return buildModelLevel(headings, 1);
    };
    
    fluid.tableOfContents.modelBuilder.finalInit = function (that) {
        
        that.convertToHeadingObjects = function (headings, anchorInfo) {
            headings = $(headings);
            return fluid.transform(headings, function (heading, index) {
                return {
                    level: that.headingCalculator.getHeadingLevel(heading),
                    text: $(heading).text(),
                    url: anchorInfo[index].url
                };
            });
        };
        
        that.assembleModel = function (headings, anchorInfo) {
            var headingInfo = that.convertToHeadingObjects(headings, anchorInfo);
            return that.toModel(headingInfo);
        };
    };
    
    fluid.defaults("fluid.tableOfContents.modelBuilder", {
        gradeNames: ["fluid.littleComponent", "autoInit"],
        finalInitFunction: "fluid.tableOfContents.modelBuilder.finalInit",
        components: {
            headingCalculator: {
                type: "fluid.tableOfContents.modelBuilder.headingCalculator"
            }
        },
        invokers: {
            toModel: "fluid.tableOfContents.modelBuilder.toModel"
        }
    });
    
    /*************************************
    * ToC ModelBuilder headingCalculator *
    **************************************/
    fluid.registerNamespace("fluid.tableOfContents.modelBuilder.headingCalculator");
    
    fluid.tableOfContents.modelBuilder.headingCalculator.finalInit = function (that) {
        that.getHeadingLevel = function (heading) {
            return $.inArray(heading.tagName, that.options.levels) + 1;
        };
    };
    
    fluid.defaults("fluid.tableOfContents.modelBuilder.headingCalculator", {
        gradeNames: ["fluid.littleComponent", "autoInit"],
        finalInitFunction: "fluid.tableOfContents.modelBuilder.headingCalculator.finalInit",
        levels: ["H1", "H2", "H3", "H4", "H5", "H6"]
    });
    
    /*************
    * ToC Levels *
    **************/
    fluid.registerNamespace("fluid.tableOfContents.levels");
    
    fluid.tableOfContents.levels.finalInit = function (that) {
        fluid.fetchResources(that.options.resources, function () {
            that.container.append(that.options.resources.template.resourceText);
            that.refreshView();
        });        
    };
    
    // The current state of this tree generation code is a result of missing framework supports.
    // In the future it is envisioned that it will be greatly simplified through the use of antigens.
    // See FLUID-4261: http://issues.fluidproject.org/browse/FLUID-4261
    fluid.tableOfContents.levels.generateTree = function (startLevel, endLevel) {
        var tree = {};
        var componentID = "level" + startLevel;
        var parentLevel = startLevel - 1;
        var childLevel = startLevel + 1;
        var controlledBy = (parentLevel ? "{headingPath" + parentLevel + "}." : "") + "headings";
        var value = "headingValue" + startLevel;
        var path = "headingPath" + startLevel;
        
        tree[componentID] = {
            children: [
                {
                    expander: {
                        type: "fluid.renderer.repeat",
                        repeatID: "items:",
                        controlledBy: controlledBy,
                        valueAs: value,
                        pathAs: path,
                        tree: {
                            expander: [
                                {
                                    type: "fluid.renderer.condition",
                                    condition: "{" + value + "}.text",
                                    trueTree: {
                                        link: {
                                            target: "${{" + path + "}.url}",
                                            linktext: "${{" + path + "}.text}"
                                        }
                                    }
                                }
                            ]
                        }
                    }
                }
            ]
        };
        
        if (childLevel <= endLevel) {
            tree[componentID].children[0].expander.tree.expander.push({
                type: "fluid.renderer.condition",
                condition: "{" + value + "}.headings",
                trueTree: fluid.tableOfContents.levels.generateTree(childLevel, endLevel)
            });
        }
        
        return tree;
    };
 
    fluid.tableOfContents.levels.produceTree = function (that) {
        return fluid.tableOfContents.levels.generateTree(1, that.options.maxLevel);
    };
     
    fluid.defaults("fluid.tableOfContents.levels", {
        gradeNames: ["fluid.rendererComponent", "autoInit"],
        finalInitFunction: "fluid.tableOfContents.levels.finalInit",
        produceTree: "fluid.tableOfContents.levels.produceTree",
        selectors: {
            level1: ".flc-toc-levels-level1",
            level2: ".flc-toc-levels-level2",
            level3: ".flc-toc-levels-level3",
            level4: ".flc-toc-levels-level4",
            level5: ".flc-toc-levels-level5",
            level6: ".flc-toc-levels-level6",
            items: ".flc-toc-levels-items",
            link: ".flc-toc-levels-link"
        },
        repeatingSelectors: ["level1", "level2", "level3", "level4", "level5", "level6", "items"],
        model: {
            headings: [] // [text: heading, url: linkURL, headings: [ an array of subheadings in the same format]
        },
        maxLevel: 6, // look into calculating this programattically.
        resources: {
            template: {
                forceCache: true,
                url: "../html/TableOfContents.html"
            }
        }
    });

})(jQuery, fluid_1_4);
