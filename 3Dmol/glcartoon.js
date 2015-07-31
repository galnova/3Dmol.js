//glcartoon.js
//This contains all the routines for rendering a cartoon given a set
//of atoms with assigned secondary structure

//TODO: generate normals directly in drawStrip and drawThinStrip

var $3Dmol = $3Dmol || {};


/**@typedef CartoonStyleSpec
 * @prop {ColorSpec} color - solid color, may specify as 'spectrum'
 * @prop {string} style - style of cartoon rendering (default, trace, oval, rectangle, parabola)
 * @prop {number} thickness - cartoon strand thickness, default is 0.4
 * @prop {number} width - cartoon strand width, default is secondary structure-dependent
 * @prop {number} opacity - set opacity from 0-1; transparency is set per-chain with a warning outputted in the event of ambiguity
 * @prop {}
 * In nucleic acids, the base cylinders obtain their color from the atom to which the cylinder is drawn, which
 * is 'N1' for purines (resn: 'A', 'G', 'DA', 'DG') and 'N3' for pyrimidines (resn: 'C', 'U', 'DC', 'DT').
 * The different nucleobases can therefore be distinguished as follows:
 * @example
 * viewer.setStyle({resn:'DA', atom:'N1'}, {cartoon:{color:'red'}});
 * viewer.setStyle({resn:'DG', atom:'N1'}, {cartoon:{color:'green'}});
 * viewer.setStyle({resn:'DC', atom:'N3'}, {cartoon:{color:'blue'}});
 * viewer.setStyle({resn:'DT', atom:'N3'}, {cartoon:{color:'yellow'}});
 */

/**
 * @ignore
 * @param {$3Dmol.Object3D} group
 * @param {AtomSpec} atomlist
 * @param {$3Dmol.Gradient} gradientscheme
 */
$3Dmol.drawCartoon = (function() {

    var defaultNum = 5; // for cross-sectional shape
    var defaultDiv = 5; // for length-wise splicing

    var coilWidth = 0.5;
    var helixSheetWidth = 1.3;
    var nucleicAcidWidth = 0.8;
    var defaultThickness = 0.4; 

    // helper functions

    // Catmull-Rom subdivision
    var subdivide = function(_points, DIV) { // points as Vector3
        var ret = [];
        var points = _points;
        points = []; // Smoothing test
        points.push(_points[0]);
        
        var i, lim, size;
        var p0, p1, p2, p3, v0, v1;
        
        for (i = 1, lim = _points.length - 1; i < lim; i++) {
            p1 = _points[i]; p2 = _points[i + 1];
            if (p1.smoothen)
                points.push(new $3Dmol.Vector3((p1.x + p2.x) / 2, (p1.y + p2.y) / 2,
                        (p1.z + p2.z) / 2));
            else
                points.push(p1);
        }
        points.push(_points[_points.length - 1]);

        
        for (i = -1, size = points.length; i <= size - 3; i++) {
            p0 = points[(i === -1) ? 0 : i];
            p1 = points[i + 1]; p2 = points[i + 2];
            p3 = points[(i === size - 3) ? size - 1 : i + 3];
            v0 = new $3Dmol.Vector3().subVectors(p2, p0).multiplyScalar(0.5);
            v1 = new $3Dmol.Vector3().subVectors(p3, p1).multiplyScalar(0.5);

            for ( var j = 0; j < DIV; j++) {
                var t = 1.0 / DIV * j;
                var x = p1.x + t * v0.x + t * t * 
                        (-3 * p1.x + 3 * p2.x - 2 * v0.x - v1.x) + t * t * t *
                        (2 * p1.x - 2 * p2.x + v0.x + v1.x);
                var y = p1.y + t * v0.y + t * t * 
                        (-3 * p1.y + 3 * p2.y - 2 * v0.y - v1.y) + t * t * t *
                        (2 * p1.y - 2 * p2.y + v0.y + v1.y);
                var z = p1.z + t * v0.z + t * t * 
                        (-3 * p1.z + 3 * p2.z - 2 * v0.z - v1.z) + t * t * t * 
                        (2 * p1.z - 2 * p2.z + v0.z + v1.z);
                        
                var pt = new $3Dmol.Vector3(x, y, z);
                
                var atomIndex = Math.floor( (ret.length+2) / DIV);
                
                if (_points[atomIndex] !== undefined && _points[atomIndex].atom !== undefined)
                    pt.atom = _points[atomIndex].atom;
                    
                ret.push(pt);
            }
        }
        ret.push(points[points.length - 1]);
        return ret;
    };

    var drawThinStrip = function(group, p1, p2, colors, div) {
    
        var geo = new $3Dmol.Geometry(true);       
        var offset, vertoffset;
        var color;

        
        for ( var i = 0, lim = p1.length; i < lim; i++) {
            
            color = $3Dmol.CC.color(colors[Math.round((i - 1) / div)]);
           
            geoGroup = geo.updateGeoGroup(2);
            var vertexArray = geoGroup.vertexArray;
            var colorArray = geoGroup.colorArray;
            var faceArray = geoGroup.faceArray;
            offset = geoGroup.vertices; vertoffset = offset*3;
            
            vertexArray[vertoffset] = p1[i].x;
            vertexArray[vertoffset+1] = p1[i].y;
            vertexArray[vertoffset+2] = p1[i].z;
            
            vertexArray[vertoffset+3] = p2[i].x;
            vertexArray[vertoffset+4] = p2[i].y;
            vertexArray[vertoffset+5] = p2[i].z;
            
            for (var j = 0; j < 6; ++j)
                colorArray[vertoffset+3*j] = color.r; colorArray[vertoffset+1+3*j] = color.g; colorArray[vertoffset+2+3*j] = color.b;
           
            if (i > 0) {
                var faces = [offset, offset + 1, offset - 1, offset - 2];
                var faceoffset = geoGroup.faceidx;
                
                faceArray[faceoffset] = faces[0]; faceArray[faceoffset+1] = faces[1]; faceArray[faceoffset+2] = faces[3];
                faceArray[faceoffset+3] = faces[1]; faceArray[faceoffset+4] = faces[2]; faceArray[faceoffset+5] = faces[3];

                geoGroup.faceidx += 6;
            }
            
            geoGroup.vertices += 2;
        }
        
        geo.initTypedArrays();
        geo.setUpNormals();
        
        var material = new $3Dmol.MeshDoubleLambertMaterial();
        if(typeof(opacity) === 'number' && opacity >= 0 && opacity < 1) {
            material.transparent = true;
            material.opacity = opacity;
        }
        material.vertexColors = $3Dmol.FaceColors;
        var mesh = new $3Dmol.Mesh(geo, material);

        group.add(mesh);
    };

    var drawShapeStrip = function(group, points, colors, div, thickness, opacity, shape) {

        // points is a 2D array, dimensionality given by [num = cross-sectional resolution][len = length of strip]
        var i, j, num, len;
        num = points.length;
        if (num < 2 || points[0].length < 2) return;

        div = div || axisDIV;
        for (i = 0; i < num; i++) { // spline to generate greater length-wise resolution
            points[i] = subdivide(points[i], div)
        }
        len = points[0].length;

        if (!thickness) // if thickness is 0, we can use a smaller geometry than this function generates
            return drawThinStrip(group, points[0], points[num-1], colors, div);


        var geo = new $3Dmol.Geometry(true);
        var axis, cs_shape, cs_bottom, cs_top;

        // cache the available cross-sectional shapes
        var cs_ellipse = [], cs_rectangle = [], cs_parabola = [];
        for (j=0; j < num; j++) {
            cs_ellipse.push(0.25 + 1.5*Math.sqrt((num-1)*j - Math.pow(j, 2))/(num-1));
            cs_rectangle.push(0.5);
            cs_parabola.push(2*(Math.pow(j/num, 2) - j/num) + 0.6);
        }

        /* face_refs array is used to generate faces from vertexArray iteratively.
           As we move through each cross-sectional segment of points, we draw lateral
           faces backwards to the previous cross-sectional segment.

           To correctly identify the points needed to make each face we use this
           array as a lookup table for the relative indices of each needed point
           in the vertices array.

           4 points are used to create 2 faces.
        */

        var face_refs = [];
        for (j = 0; j < num*2-1; j++) {
            /* [curr vertex in curr cross-section,
                next vertex in curr cross-section,
                next vertex in prev cross-section,
                curr vertex in prev cross-section] */
            face_refs[j] = [j, j+1, j+1-2*num, j-2*num];
        }
        // last face is different. easier to conceptualize this by drawing a diagram
        face_refs[num*2-1] = [j, j+1-2*num, j+1-4*num, j-2*num];

                
        var v_offset, va_offset, f_offset;
        var color;
        var geoGroup = geo.updateGeoGroup(2*num*len); // ensure vertex capacity
        
        for (i = 0; i < len; i++) {
        
            color = $3Dmol.CC.color(colors[Math.round(colors.length*i/len)]);
            
            cs_bottom = [];
            cs_top = [];
            axis = [];

            if (points[0][i].atom !== undefined) // TODO better edge case handling
            {
                if (shape === "oval")
                    cs_shape = cs_ellipse;
                else if (shape === "rectangle")
                    cs_shape = cs_rectangle;
                else if (shape === "parabola")
                    cs_shape = cs_parabola;
            }
            if (!cs_shape) cs_shape = cs_rectangle;

            
            // calculate thickness at each width point, from cross-sectional shape
            var toNext, toSide;
            for (j = 0; j < num; j++)
            {
                if (i < len-1)
                    toNext = points[j][i+1].clone().sub(points[j][i]);
                else
                    toNext = points[j][i-1].clone().sub(points[j][i]).negate();

                if (j < num-1)
                    toSide = points[j+1][i].clone().sub(points[j][i]);
                else
                    toSide = points[j-1][i].clone().sub(points[j][i]).negate();

                axis[j] = toSide.cross(toNext).normalize().multiplyScalar(thickness*cs_shape[j]);
            }

            // generate vertices by applying cross-sectional shape thickness to input points
            for (j = 0; j < num; j++)
                cs_bottom[j] = points[j][i].clone().add(axis[j].clone().negate());
            for (j = 0; j < num; j++)
                cs_top[j] = points[j][i].clone().add(axis[j]);
            

            /* Until this point the vertices have been dealt with as $3Dmol.Vector3() objects,
               but we need to serialize them into the geoGroup.vertexArray, where every three
               indices represents the next vertex. The colorArray is analogous.

               In the following for-loops, j iterates through VERTICES so we need to index
               them in vertexArray by 3*j + either 0, 1, or 2 for xyz or rgb component.
            */

            var vertexArray = geoGroup.vertexArray;
            var colorArray = geoGroup.colorArray;
            var faceArray = geoGroup.faceArray;
            v_offset = geoGroup.vertices; va_offset = v_offset*3; // in case geoGroup already contains vertices

            // bottom edge of cross-section, vertices [0, num)
            for (j = 0; j < num; j++) {
                vertexArray[va_offset + 3*j + 0] = cs_bottom[j].x;
                vertexArray[va_offset + 3*j + 1] = cs_bottom[j].y;
                vertexArray[va_offset + 3*j + 2] = cs_bottom[j].z;
            }

            // top edge of cross-section, vertices [num, 2*num)
            // add these backwards, so that each cross-section's vertices are added sequentially to vertexArray
            for (j = 0; j < num; j++) {
                vertexArray[va_offset + 3*j + 0 + 3*num] = cs_top[num-1-j].x;
                vertexArray[va_offset + 3*j + 1 + 3*num] = cs_top[num-1-j].y;
                vertexArray[va_offset + 3*j + 2 + 3*num] = cs_top[num-1-j].z;
            }
            
            for (j = 0; j < 2*num; ++j) {
                colorArray[va_offset + 3*j + 0] = color.r;
                colorArray[va_offset + 3*j + 1] = color.g;
                colorArray[va_offset + 3*j + 2] = color.b;
            }
            
            if (i > 0) {
             
                for (j = 0; j < num*2; j++) {
                
                    // get VERTEX indices of the 4 points of a rectangular face (as opposed to literal vertexArray indices)
                    var face = [v_offset + face_refs[j][0],
                                v_offset + face_refs[j][1],
                                v_offset + face_refs[j][2],
                                v_offset + face_refs[j][3]];
                    
                    f_offset = geoGroup.faceidx;    
                    
                    // need 2 triangles to draw a face between 4 points
                    faceArray[f_offset]   = face[0];
                    faceArray[f_offset+1] = face[1]; 
                    faceArray[f_offset+2] = face[3];

                    faceArray[f_offset+3] = face[1];
                    faceArray[f_offset+4] = face[2];
                    faceArray[f_offset+5] = face[3];
                    
                    geoGroup.faceidx += 6;
                    
                    // TODO implement clickable
                }

            }
            
            geoGroup.vertices += 2*num;
        }

        // for terminal faces
        var vertexArray = geoGroup.vertexArray;
        var colorArray = geoGroup.colorArray;
        var faceArray = geoGroup.faceArray;
        v_offset = geoGroup.vertices; va_offset = v_offset*3; f_offset = geoGroup.faceidx;

        for (i = 0; i<num-1; i++) // "bottom" face
        {
            var face = [i, i+1, 2*num-2-i, 2*num-1-i];

            f_offset = geoGroup.faceidx;

            faceArray[f_offset]   = face[0];
            faceArray[f_offset+1] = face[1]; 
            faceArray[f_offset+2] = face[3];

            faceArray[f_offset+3] = face[1];
            faceArray[f_offset+4] = face[2];
            faceArray[f_offset+5] = face[3];

            geoGroup.faceidx += 6;
        }

        for (i = 0; i<num-1; i++) // "top" face
        {
            var face = [v_offset-1-i, v_offset-2-i, v_offset-2*num+i+1, v_offset-2*num+i];

            f_offset = geoGroup.faceidx;

            faceArray[f_offset]   = face[0];
            faceArray[f_offset+1] = face[1]; 
            faceArray[f_offset+2] = face[3];

            faceArray[f_offset+3] = face[1];
            faceArray[f_offset+4] = face[2];
            faceArray[f_offset+5] = face[3];

            geoGroup.faceidx += 6;
        }
        
        geo.initTypedArrays();
        geo.setUpNormals();
        
        var material = new $3Dmol.MeshDoubleLambertMaterial();
        material.vertexColors = $3Dmol.FaceColors;
        if (typeof(opacity) === 'number' && opacity >= 0 && opacity < 1) {
            material.transparent = true;
            material.opacity = opacity;
        }
        var mesh = new $3Dmol.Mesh(geo, material);
        group.add(mesh);
    };

    var drawPlainStrip = function(group, points, colors, div, thickness, opacity) {
        if ((points.length) < 2)
            return;

        var p1, p2;
        p1 = points[0];
        p2 = points[points.length-1];

        div = div || axisDIV;
        p1 = subdivide(p1, div);
        p2 = subdivide(p2, div);
        if (!thickness)
            return drawThinStrip(group, p1, p2, colors, div);

        var geo = new $3Dmol.Geometry(true);
        
        //var vs = geo.vertices, fs = geo.faces;
        var vs = [], fs = [];
        var axis, p1v, p2v, a1v, a2v;
        
        var faces = [ [ 0, 2, -6, -8 ],
                      [ -4, -2, 6, 4 ],
                      [ 7, -1, -5, 3 ],
                      [ -3, 5, 1, -7 ] ];
                
        var offset, vertoffset, faceoffset;
        var color;
        var currentAtom, lastAtom;
        var i, lim, j;
        var face1, face2, face3;
        var geoGroup;
        
        for (i = 0, lim = p1.length; i < lim; i++) {
        
            color = $3Dmol.CC.color(colors[Math.round(colors.length*i/lim)]);
            
            vs.push(p1v = p1[i]); // 0
            vs.push(p1v);         // 1
            vs.push(p2v = p2[i]); // 2
            vs.push(p2v);         // 3
            if (i < lim - 1) {
                var toNext = p1[i + 1].clone().sub(p1[i]);
                var toSide = p2[i].clone().sub(p1[i]);
                axis = toSide.cross(toNext).normalize().multiplyScalar(
                        thickness);
            }
            vs.push(a1v = p1[i].clone().add(axis)); // 4
            vs.push(a1v); // 5
            vs.push(a2v = p2[i].clone().add(axis)); // 6
            vs.push(a2v); // 7
            
            if (p1v.atom !== undefined)
                currentAtom = p1v.atom;
            
            geoGroup = geo.updateGeoGroup(8);
            var vertexArray = geoGroup.vertexArray;
            var colorArray = geoGroup.colorArray;
            var faceArray = geoGroup.faceArray;
            offset = geoGroup.vertices; vertoffset = offset*3;
            
            vertexArray[vertoffset]    = p1v.x; vertexArray[vertoffset+1]  = p1v.y; vertexArray[vertoffset+2]  = p1v.z;
            vertexArray[vertoffset+3]  = p1v.x; vertexArray[vertoffset+4]  = p1v.y; vertexArray[vertoffset+5]  = p1v.z;
            vertexArray[vertoffset+6]  = p2v.x; vertexArray[vertoffset+7]  = p2v.y; vertexArray[vertoffset+8]  = p2v.z;
            vertexArray[vertoffset+9]  = p2v.x; vertexArray[vertoffset+10] = p2v.y; vertexArray[vertoffset+11] = p2v.z;
            vertexArray[vertoffset+12] = a1v.x; vertexArray[vertoffset+13] = a1v.y; vertexArray[vertoffset+14] = a1v.z;
            vertexArray[vertoffset+15] = a1v.x; vertexArray[vertoffset+16] = a1v.y; vertexArray[vertoffset+17] = a1v.z;
            vertexArray[vertoffset+18] = a2v.x; vertexArray[vertoffset+19] = a2v.y; vertexArray[vertoffset+20] = a2v.z;
            vertexArray[vertoffset+21] = a2v.x; vertexArray[vertoffset+22] = a2v.y; vertexArray[vertoffset+23] = a2v.z;
            
            for (j = 0; j < 8; ++j) {                
                colorArray[vertoffset+3*j] = color.r; colorArray[vertoffset+1+3*j] = color.g; colorArray[vertoffset+2+3*j] = color.b;
            }
            
            if (i > 0) {
             
                //both points have distinct atoms
                var diffAtoms = ((lastAtom !== undefined && currentAtom !== undefined) && lastAtom.serial !== currentAtom.serial);
                
                for (j = 0; j < 4; j++ ) {
                
                    var face = [offset + faces[j][0], offset + faces[j][1], offset + faces[j][2], offset + faces[j][3]];
                    
                    faceoffset = geoGroup.faceidx;    
                    
                    faceArray[faceoffset] = face[0]; faceArray[faceoffset+1] = face[1]; faceArray[faceoffset+2] = face[3];
                    faceArray[faceoffset+3] = face[1]; faceArray[faceoffset+4] = face[2]; faceArray[faceoffset+5] = face[3];
                    
                    geoGroup.faceidx += 6;
                    
                    if (currentAtom.clickable || lastAtom.clickable) {
                        
                        var p1a = vs[face[3]].clone(), p1b = vs[face[0]].clone(),
                            p2a = vs[face[2]].clone(), p2b = vs[face[1]].clone();
                        
                        p1a.atom = vs[face[3]].atom || null; //should be same
                        p2a.atom = vs[face[2]].atom || null; 
                        
                        
                        p1b.atom = vs[face[0]].atom || null; //should be same                      
                        p2b.atom = vs[face[1]].atom || null; 
                        
                        if (diffAtoms) {
                            var m1 = p1a.clone().add(p1b).multiplyScalar(0.5);
                            var m2 = p2a.clone().add(p2b).multiplyScalar(0.5);
                            var m = p1a.clone().add(p2b).multiplyScalar(0.5);
                            
                            if (j % 2 === 0)
                            {
                                if (lastAtom.clickable) {
                                    face1 = new $3Dmol.Triangle(m1, m, p1a);
                                    face2 = new $3Dmol.Triangle(m2, p2a, m);
                                    face3 = new $3Dmol.Triangle(m, p2a, p1a);
                                    lastAtom.intersectionShape.triangle.push(face1);
                                    lastAtom.intersectionShape.triangle.push(face2);
                                    lastAtom.intersectionShape.triangle.push(face3);
                                }
                                
                                if (currentAtom.clickable) {
                                    face1 = new $3Dmol.Triangle(p1b, p2b, m);
                                    face2 = new $3Dmol.Triangle(p2b, m2, m);
                                    face3 = new $3Dmol.Triangle(p1b, m, m1);
                                    currentAtom.intersectionShape.triangle.push(face1);
                                    currentAtom.intersectionShape.triangle.push(face2);
                                    currentAtom.intersectionShape.triangle.push(face3);
                                }
                            }
                            else {
                                if (currentAtom.clickable) {
                                    face1 = new $3Dmol.Triangle(m1, m, p1a);
                                    face2 = new $3Dmol.Triangle(m2, p2a, m);
                                    face3 = new $3Dmol.Triangle(m, p2a, p1a);
                                    currentAtom.intersectionShape.triangle.push(face1);
                                    currentAtom.intersectionShape.triangle.push(face2);
                                    currentAtom.intersectionShape.triangle.push(face3);
                                }
                                
                                if (lastAtom.clickable) {
                                    face1 = new $3Dmol.Triangle(p1b, p2b, m);
                                    face2 = new $3Dmol.Triangle(p2b, m2, m);
                                    face3 = new $3Dmol.Triangle(p1b, m, m1);
                                    lastAtom.intersectionShape.triangle.push(face1);
                                    lastAtom.intersectionShape.triangle.push(face2);
                                    lastAtom.intersectionShape.triangle.push(face3);
                                }                          
                            }
                            
                        }
                        
                        //face for single atom
                        else if (currentAtom.clickable) {
                            face1 = new $3Dmol.Triangle(p1b, p2b, p1a);
                            face2 = new $3Dmol.Triangle(p2b, p2a, p1a);
                            currentAtom.intersectionShape.triangle.push(face1);
                            currentAtom.intersectionShape.triangle.push(face2);
                        }
                        
                    }
                    
                }
            }
            
            geoGroup.vertices += 8;
            lastAtom = currentAtom;
        }
        

        var vsize = vs.length - 8; // Cap
        
        geoGroup = geo.updateGeoGroup(8);
        var vertexArray = geoGroup.vertexArray;
        var colorArray = geoGroup.colorArray;
        var faceArray = geoGroup.faceArray;
        offset = geoGroup.vertices; vertoffset = offset*3; faceoffset = geoGroup.faceidx;
        
        for (i = 0; i < 4; i++) {
            vs.push(vs[i * 2]);
            vs.push(vs[vsize + i * 2]);
            
            var v1 = vs[i * 2], v2 = vs[vsize + i * 2];
            
            vertexArray[vertoffset+6*i] = v1.x; vertexArray[vertoffset+1+6*i] = v1.y; vertexArray[vertoffset+2+6*i] = v1.z;
            vertexArray[vertoffset+3+6*i] = v2.x; vertexArray[vertoffset+4+6*i] = v2.y; vertexArray[vertoffset+5+6*i] = v2.z;
            
            colorArray[vertoffset+6*i] = color.r; colorArray[vertoffset+1+6*i] = color.g; colorArray[vertoffset+2+6*i] = color.b;
            colorArray[vertoffset+3+6*i] = color.r; colorArray[vertoffset+4+6*i] = color.g; colorArray[vertoffset+5+6*i] = color.b;

        }
        
        vsize += 8;
                
        face1 = [offset, offset + 2, offset + 6, offset + 4];
        face2 = [offset + 1, offset + 5, offset + 7, offset + 3];
        
        faceArray[faceoffset] = face1[0]; faceArray[faceoffset+1] = face1[1]; faceArray[faceoffset+2] = face1[3];
        faceArray[faceoffset+3] = face1[1]; faceArray[faceoffset+4] = face1[2]; faceArray[faceoffset+5] = face1[3];
        faceArray[faceoffset+6] = face2[0]; faceArray[faceoffset+7] = face2[1]; faceArray[faceoffset+8] = face2[3];
        faceArray[faceoffset+9] = face2[1]; faceArray[faceoffset+10] = face2[2]; faceArray[faceoffset+11] = face2[3];
        
        geoGroup.faceidx += 12;
        geoGroup.vertices += 8;
        
        //TODO: Add intersection planes for caps
        
        geo.initTypedArrays();
        geo.setUpNormals();
        
                // HalfEdgeRec used to store adjacency info of mesh
        var HalfEdge=function(vertIdx){
            this.vert=vertIdx; // Vertex index at the end of this half-edge
            this.twin=null;    // Oppositely oriented adjacent half-edge
            this.next=null;    //Next half-edge around the face
        };
        
        var computeAdjacency=function(faces,faceCount,vertCount){
            //all pieces of the half-edge data structure
            edges=[];
            
            // a hash table to hold the adjaceney info
            // - Keys are pairs of vertex indices
            // - Values are pointers to half-edge
            var edgeTable={};
            var len=0;
            
            //Plow through faces and fill all half-edge info except twin pointers:
            for(var i=0;i<faceCount;i+=3){
                var A=faces[i];
                var B=faces[i+1];
                var C=faces[i+2];
               // console.log("A="+A+ " B="+ B+ " C="+C);
                
                //create the half-edge that goes from C to A
                var CA=new HalfEdge(A);
                edges.push(CA);
                //create the half-edge that goes from A to B
                var AB=new HalfEdge(B);
                edges.push(AB);
                //create the half-edge that goes from B to C
                var BC=new HalfEdge(C);
                edges.push(BC);
                
                CA.next=AB;
                AB.next=BC;
                BC.next=CA;
                
                edgeTable[C|(A<<16)]=CA; 
                edgeTable[A|(B<<16)]=AB; 
                edgeTable[B|(C<<16)]=BC;
            }
            
            //varify that the mesh is clean
            for(var key in edgeTable){
                if(edgeTable.hasOwnProperty(key)){
                    len++;
                }
            }
            if(len!=faceCount*3){
                console.warn("Bad mesh: duplicated edges or inconsistent winding.len="+len+" faceCount="+faceCount+" vertCount="+vertCount);
            }
            
            //Populate the twin pointers by iterating over the hash table
            var boundaryCount=0;
            for(var key in edgeTable){
                if(edgeTable.hasOwnProperty(key)){
                    var twinKey=((key&0xffff)<<16)|(key>>16);
                    if(edgeTable.hasOwnProperty(twinKey)){
                        edgeTable[key].twin=edgeTable[twinKey];
                        edgeTable[twinKey].twin=edgeTable[key];
                    }else{
                        boundaryCount+=1;
                    }
                }
            }
            
            var ret=new Uint16Array(faceCount*6);
            // Now that we have a half-edge structure, it's easy to create adjacency info for WebGL
            if(boundaryCount>0){
                console.log("Mesh is not watertight. Contains "+boundaryCount +" edges");
                
                for(var i=0;i<faceCount;i+=3){
                    ret[i*2+0]=edges[i+2].vert;
                    ret[i*2+1]=edges[i+0].twin==null?ret[i*2+0]:edges[i+0].twin.next.vert;
                    ret[i*2+2]=edges[i+0].vert;
                    ret[i*2+3]=edges[i+1].twin==null?ret[i*2+1]:edges[i+1].twin.next.vert;                  
                    ret[i*2+4]=edges[i+1].vert;
                    ret[i*2+5]=edges[i+2].twin==null?ret[i*2+2]:edges[i+2].twin.next.vert;
                }
            }
            else{
                for(var i=0;i<faceCount;i+=3){
                    ret[i*2+0]=edges[i+2].vert;
                    ret[i*2+1]=edges[i+0].twin.next.vert;
                    ret[i*2+2]=edges[i+0].vert;
                    ret[i*2+3]=edges[i+1].twin.next.vert;                   
                    ret[i*2+4]=edges[i+1].vert;
                    ret[i*2+5]=edges[i+2].twin.next.vert;
                } 
            }
            
            return ret;
        };
        
        //geoGroup.adjFaceArray = computeAdjacency(faceArray,faceArray.length,offset);
        
        var material = new $3Dmol.MeshDoubleLambertMaterial();
        material.vertexColors = $3Dmol.FaceColors;
        if(typeof(opacity) === 'number' && opacity >= 0 && opacity < 1) {
            material.transparent = true;
            material.opacity = opacity;
        }
        var mesh = new $3Dmol.Mesh(geo, material);
        group.add(mesh);   
    };

    //TODO: Need to update this (will we ever use this?)
    var drawSmoothCurve = function(group, _points, width, colors, div) {
        if (_points.length === 0)
            return;

        div = (div === undefined) ? 5 : div;

        var geo = new $3Dmol.Geometry();
        var points = subdivide(_points, div);
                /*
        for ( var i = 0; i < points.length; i++) {
            geo.vertices.push(points[i]);
            geo.colors.push($3Dmol.color(colors[(i == 0) ? 0 : Math.round((i - 1)
                    / div)]));
        }
                */
        var lineMaterial = new $3Dmol.LineBasicMaterial({
            linewidth : width
        });
        lineMaterial.vertexColors = true;
        var line = new $3Dmol.Line(geo, lineMaterial);
        line.type = $3Dmol.LineStrip;
        group.add(line);
    };

    var drawStrip = function(group, points, colors, div, thickness, opacity, shape)
    {
        if (!shape || shape === "default")
            drawPlainStrip(group, points, colors, div, thickness, opacity);
        else
            drawShapeStrip(group, points, colors, div, thickness, opacity, shape);
    }

    var drawStrand = function(group, atomList, geo, gradientScheme, fill, doNotSmoothen, num, div)
    {
        var num = num || defaultNum;
        var div = div || defaultDiv;
        doNotSmoothen = !!(doNotSmoothen);

                        //  proteins    na backbone  na terminus                  nucleobases
        var cartoonAtoms = ["CA", "O",  "P", "OP2",  "O5'", "O3'", "C5'", "C2'",  "N1", "N3"];
        var purResns = ["DA", "DG", "A", "G"];
        var pyrResns = ["DT", "DC", "U", "C"];

        var cartoon, curr, next, currColor, nextColor, thickness, i, nextResAtom, arrow;
        var backbonePt, orientPt, prevOrientPt, terminalPt, termOrientPt, baseStartPt, baseEndPt;
        var traceGeo = null;
        var colors = [];
        var points = [];
        for (var i = 0; i < num; i++)
            points[i] = [];

        for (i in atomList)
        {
            next = atomList[i];
            
            if (next === undefined || $.inArray(next.atom, cartoonAtoms) === -1 || next.hetflag)
                continue; // skip array holes, heteroatoms, and atoms not involved in cartoon drawing

            // determine cartoon style
            cartoon = next.style.cartoon;
            if (cartoon.style === "trace") // draw cylinders connecting consecutive 'backbone' atoms
            {
                /* "trace" style just draws cylinders between consecutive 'backbone' atoms,
                    such as alpha carbon for polypeptides and phosphorus for DNA. */

                if (!traceGeo) traceGeo = new $3Dmol.Geometry(true);

                if (next.atom === "CA" || next.atom === "P")
                {
                    // determine cylinder color
                    if (gradientScheme && cartoon.color === 'spectrum')
                        nextColor = gradientScheme.valueToHex(next.resi, gradientScheme.range());
                    else
                        nextColor = $3Dmol.getColorFromStyle(next, cartoon).getHex();
                    colors.push(nextColor);

                    // determine cylinder thickness
                    if ($.isNumeric(cartoon.thickness))
                        thickness = cartoon.thickness;
                    else
                        thickness = defaultThickness;

                    /* do not draw connections between different chains, but ignore
                       differences in reschain to properly support CA-only files */
                    if (curr && curr.chain === next.chain && curr.resi + 1 === next.resi)
                    {
                        // if both atoms are same color, draw single cylinder
                        if (nextColor == currColor)
                        {
                            var color = $3Dmol.CC.color(nextColor);
                            $3Dmol.GLDraw.drawCylinder(traceGeo, curr, next, thickness, color, true, true);
                        }

                        else // otherwise draw cylinders for each color (split down the middle)
                        {
                            var midpoint = new $3Dmol.Vector3().addVectors(curr, next).multiplyScalar(0.5);
                            var color1 = $3Dmol.CC.color(currColor);
                            var color2 = $3Dmol.CC.color(nextColor);
                            $3Dmol.GLDraw.drawCylinder(traceGeo, curr, midpoint, thickness, color1, true, false);
                            $3Dmol.GLDraw.drawCylinder(traceGeo, midpoint, next, thickness, color2, false, true);
                        } // note that an atom object can be duck-typed as a $3Dmol.Vector3 in this case
                    }

                    if (curr && traceGeo && (curr.style.cartoon && curr.style.cartoon.style != "trace"
                        || curr.chain != next.chain))
                    {
                        var traceMaterial = new $3Dmol.MeshDoubleLambertMaterial();
                        traceMaterial.vertexColors = $3Dmol.FaceColors;
                        if ( typeof(traceGeo.opacity) === "number" && traceGeo.opacity >= 0 && traceGeo.opacity < 1) {
                            traceMaterial.transparent = true;
                            traceMaterial.opacity = traceGeo.opacity;
                            delete traceGeo.opacity;
                        }
                        var traceMesh = new $3Dmol.Mesh(traceGeo, traceMaterial);
                        group.add(traceMesh);
                        traceGeo = null;
                    } else if (curr) // make sure whole chain is same opacity
                    {
                        if (traceGeo.opacity)
                        {
                            if (traceGeo.opacity != curr.style.cartoon.opacity)
                            {
                                console.log("Warning: a cartoon-style chain's opacity is ambiguous");
                                traceGeo.opacity = 1;
                            }
                        }
                        else traceGeo.opacity = parseFloat(curr.style.cartoon.opacity) || 1;
                    }

                    curr = next;
                    currColor = nextColor;
                }
            }

            else // draw default-style cartoons based on secondary structure
            {
                // draw backbone through these atoms
                if (next.atom === "CA" || next.atom === "P" || next.atom === "O5'")
                {
                    // end of a chain of connected residues
                    if (curr && (curr.chain != next.chain || !(curr.resi === next.resi || curr.resi + 1 === next.resi)
                        || curr.reschain != next.reschain || curr.style.cartoon.style !== next.style.cartoon.style))
                    { 

                        if (baseEndPt) // draw the last base if it's a NA chain
                        {
                            if (terminalPt)
                                baseStartPt = new $3Dmol.Vector3().addVectors(curr, terminalPt).multiplyScalar(0.5);
                            else
                                baseStartPt = new $3Dmol.Vector3(curr.x, curr.y, curr.z);

                            $3Dmol.GLDraw.drawCylinder(geo, baseStartPt, baseEndPt, 0.4, $3Dmol.CC.color(baseEndPt.color), false, true);
                            arrow = addBackbonePoints(points, num, !doNotSmoothen, terminalPt, termOrientPt, prevOrientPt, curr, atomList, i);
                            colors.push(nextColor);
                            if (arrow) colors.push(nextColor);
                            
                            baseStartPt = null;
                            baseEndPt = null;
                        }

                        // draw accumulated strand points
                        for (i = 0; !thickness && i < num; i++)
                            drawSmoothCurve(group, points[i], 1, colors, div, points.opacity);
                        if (fill)
                            drawStrip(group, points, colors, div, thickness, points.opacity, curr.style.cartoon.style);

                        // clear arrays for points and colors
                        points = [];
                        for (i = 0; i < num; i++)
                            points[i] = [];
                        colors = [];
                    }

                    // reached next residue
                    if (curr === undefined || curr.resi != next.resi)
                    {
                        if (baseEndPt) // draw last NA residue's base
                        {
                            // start the cylinder at the midpoint between consecutive backbone atoms
                            baseStartPt = new $3Dmol.Vector3().addVectors(curr, next).multiplyScalar(0.5);
                            var startFix = baseStartPt.clone().sub(baseEndPt).multiplyScalar(0.02); //TODO: apply this as function of thickness
                            baseStartPt.add(startFix);

                            $3Dmol.GLDraw.drawCylinder(geo, baseStartPt, baseEndPt, 0.4, $3Dmol.CC.color(baseEndPt.color), false, true);
                            baseStartPt = null;
                            baseEndPt = null;   
                        }

                        // determine color and thickness of the next strand segment
                        if (gradientScheme && cartoon.color === 'spectrum')
                            nextColor = gradientScheme.valueToHex(next.resi, gradientScheme.range());
                        else
                            nextColor = $3Dmol.getColorFromStyle(next, cartoon).getHex();
                        colors.push(nextColor);
                        if ($.isNumeric(cartoon.thickness))
                            thickness = cartoon.thickness;
                        else
                            thickness = defaultThickness;

                        
                        curr = next; // advance backbone
                        //nextResAtom = atomList[parseInt(i) + resSize[curr.resn]];
                        backbonePt = new $3Dmol.Vector3(curr.x, curr.y, curr.z);
                        backbonePt.resi = curr.resi;
                        currColor = nextColor; // used for NA bases
                    }

                    // click handling
                    if (next.clickable === true &&
                        (next.intersectionShape === undefined || next.intersectionShape.triangle === undefined)) 
                        next.intersectionShape = {sphere : null, cylinder : [], line : [], triangle : []};

                }

                // atoms used to orient the backbone strand
                else if (next.atom === "O"  && curr.atom === "CA"
                      || next.atom === "OP2" && curr.atom === "P"
                      || next.atom === "C5'" && curr.atom === "O5'")
                {
                    orientPt = new $3Dmol.Vector3(next.x, next.y, next.z);
                    orientPt.resi = next.resi;
                    if (next.atom === "OP2") // for NA 3' terminus
                        termOrientPt = new $3Dmol.Vector3(next.x, next.y, next.z);
                }

                // NA 3' terminus is an edge case, need a vector for most recent O3'
                else if (next.atom === "O3'")
                {
                    terminalPt = new $3Dmol.Vector3(next.x, next.y, next.z);
                }

                // atoms used for drawing the NA base cylinders (diff for purines and pyramidines)
                else if ((next.atom === "N1" && $.inArray(next.resn.trim(), purResns) != -1) ||
                         (next.atom === "N3" && $.inArray(next.resn.trim(), pyrResns) != -1))
                {
                    baseEndPt = new $3Dmol.Vector3(next.x, next.y, next.z);
                    baseEndPt.color = $3Dmol.getColorFromStyle(next, cartoon).getHex();
                }

                // when we have a backbone point and orientation point in the same residue, accumulate strand points
                if (orientPt && backbonePt && orientPt.resi === backbonePt.resi)
                {
                    arrow = addBackbonePoints(points, num, !doNotSmoothen, backbonePt, orientPt, prevOrientPt, curr, atomList, i);
                    prevOrientPt = orientPt;
                    backbonePt = null;
                    orientPt = null;
                    colors.push(nextColor);
                    if (arrow) colors.push(nextColor);
                }
            }
        }

        if (baseEndPt) // draw last NA base if needed
        {
            if (terminalPt)
                baseStartPt = new $3Dmol.Vector3().addVectors(curr, terminalPt).multiplyScalar(0.5);
            else
                baseStartPt = new $3Dmol.Vector3(curr.x, curr.y, curr.z);

            $3Dmol.GLDraw.drawCylinder(geo, baseStartPt, baseEndPt, 0.4, $3Dmol.CC.color(baseEndPt.color), false, true);
            arrow = addBackbonePoints(points, num, !doNotSmoothen, terminalPt, termOrientPt, prevOrientPt, curr, atomList, i);
            colors.push(nextColor);
            if (arrow) colors.push(nextColor);
        }

        // for default style, draw the last strand
        for (i = 0; !thickness && i < num; i++)
            drawSmoothCurve(group, points[i], 1, colors, div, points.opacity);
        if (fill)
            drawStrip(group, points, colors, div, thickness, points.opacity, curr.style.cartoon.style);

        if (traceGeo != null) // generate last mesh for trace geometry
        {
            var traceMaterial = new $3Dmol.MeshDoubleLambertMaterial();
            traceMaterial.vertexColors = $3Dmol.FaceColors;
            if (typeof(traceGeo.opacity) === "number" && traceGeo.opacity >= 0 && traceGeo.opacity < 1) {
                traceMaterial.transparent = true;
                traceMaterial.opacity = traceGeo.opacity;
                delete traceGeo.opacity;
            }
            var traceMesh = new $3Dmol.Mesh(traceGeo, traceMaterial);
            group.add(traceMesh);
        }
    };

    var addBackbonePoints = function(points, num, smoothen, backbonePt, orientPt, prevOrientPt, backboneAtom, atomList, atomi)
    {
        var widthScalar, i, delta, v, addArrowPoints, testOpacity;
        
        // kind of hacky...
        var resSize = {ALA: 5, ARG: 11, ASN:8, ASP:8, CYS:6, GLN:9, GLU: 9, GLY:4, HIS:10, ILE:8, LEU: 8, LYS: 9, MET:8, PHE:11, PRO:7, SER:6, THR:7, TRP:14, TYR:12, VAL:7}
        var nextBBAtom, nextnextBBAtom;
        nextBBAtom = atomList[parseInt(atomi) + resSize[backboneAtom.resn]];
        if (nextBBAtom) nextnextBBAtom = atomList[parseInt(atomi) + resSize[backboneAtom.resn] + resSize[nextBBAtom.resn]];

        // the orientation vector is the normed difference from backbone atom to orientation atom
        orientPt.sub(backbonePt);
        orientPt.normalize();

        // depending on secondary structure, multiply the orientation vector by some scalar
        if (!backboneAtom.style.cartoon.width)
        {
            if (backboneAtom.ss === "c")
            {
                if (backboneAtom.atom === "P")
                    widthScalar = nucleicAcidWidth;
                else
                    widthScalar = coilWidth;
            } else if (backboneAtom.ss === "arrowtip")
                widthScalar = 0.3;
            else
                widthScalar = helixSheetWidth;
        }
        else widthScalar = backboneAtom.style.cartoon.width;

        // if 2 residues up is no longer a beta-sheet, this is where the arrowhead goes
        if (backboneAtom.ss === "s" && backboneAtom.style.cartoon.arrows && nextnextBBAtom && nextnextBBAtom.ss != "s")
        {
            addArrowPoints = true;

            for (i = atomi; i < atomList.length; i++)
            {
                if (atomList[i].resi === nextBBAtom.resi && atomList[i].atom === "CA")
                {
                    atomList[i].ss = "arrowtip"
                }
            }
        }     

        // if the angle between the previous orientation vector and current is greater than 90 degrees,
        if (prevOrientPt != null && orientPt.dot(prevOrientPt) < 0)
        {
            orientPt.negate(); // negate the orientation vector (ie. add 180 degrees)
        }
        // this ensures that the strand never twists more than 90 degrees between consecutive backbone atoms

        orientPt.multiplyScalar(widthScalar);        
        for (i = 0; i < num; i++)
        {
            // produces NUM incremental points from backbone atom minus orientation vector
            //  to backbone atom plus orientation vector
            delta = -1 + i * 2/(num - 1); // -1 to 1 incrementing by num
            v = new $3Dmol.Vector3(backbonePt.x + delta * orientPt.x,
                                   backbonePt.y + delta * orientPt.y,
                                   backbonePt.z + delta * orientPt.z);
            v.atom = backboneAtom;
            if (smoothen && backboneAtom.ss === "s") 
                v.smoothen = true;
            points[i].push(v); // a num-length array of arrays, where each inner array contains length-wise points
                               // along the backbone offset by some constant pertaining to its cell in the outer array
        }

        if (addArrowPoints)
        {
            orientPt.multiplyScalar(2);
            for (i = 0; addArrowPoints && i < num; i++)
            {
                delta = -1 + i * 2/(num - 1); // -1 to 1 incrementing by num
                v = new $3Dmol.Vector3(backbonePt.x + delta * orientPt.x,
                                       backbonePt.y + delta * orientPt.y,
                                       backbonePt.z + delta * orientPt.z);
                v.atom = backboneAtom;
                points[i].push(v);
            }
        }

        // make sure chain is all the same opacity
        testOpacity = parseFloat(backboneAtom.style.cartoon.opacity) || 1;
        if (points.opacity)
        {
            if (points.opacity != testOpacity)
            {
                console.log("Warning: a cartoon-style chain's opacity is ambiguous");
                points.opacity = 1;
            }

        } else points.opacity = testOpacity;

        if (backboneAtom.ss === "arrowtip") backboneAtom.ss = "s";
        return addArrowPoints;
    }

    // actual function call
    var drawCartoon = function(group, atomlist, laddergeo, gradientscheme) {
                                                       //fill  doNotSmoothen
        drawStrand(group, atomlist, laddergeo, gradientscheme, true, false);        

    };

    return drawCartoon;
})();
