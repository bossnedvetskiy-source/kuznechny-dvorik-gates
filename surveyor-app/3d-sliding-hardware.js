import * as THREE from '../naves/vendor/three.module.js';

// DEV preview hardware. Heights and proportions are schematic only; foundation,
// roller selection, anchoring and loads still require an engineered specification.
export function renderSlidingHardware({group,base,opening,installation,openingStart,
  postWidth,postMat,frameGeometry,ownedGeometries,ownedMaterials}){
  const p=installation,baseX=openingStart-p.start,z=p.trackOffset;
  const foundationMat=new THREE.MeshStandardMaterial({
    color:0x999b91,metalness:.03,roughness:.94
  });
  const steelMat=new THREE.MeshStandardMaterial({
    color:0x343f48,metalness:.68,roughness:.42
  });
  const wheelMat=new THREE.MeshStandardMaterial({
    color:0x262b2e,metalness:.34,roughness:.70
  });
  const warningMat=new THREE.MeshStandardMaterial({
    color:0xd7653b,metalness:.15,roughness:.67
  });
  ownedMaterials.push(foundationMat,steelMat,wheelMat,warningMat);
  const fixture=new THREE.Group();
  fixture.userData.kdSlidingFixedHardware=true;
  fixture.userData.kdSlidingSide=opening.sideId;
  group.add(fixture);
  const frame=(w,h,d,x,y,zpos,mat=steelMat)=>frameGeometry(
    fixture,base,w,h,d,baseX+x,y,zpos,mat);
  const middle=(p.foundation.from+p.foundation.to)/2;
  // A visible cap is shown; the rest of the concrete foundation is buried.
  const footing=frame(Math.max(.48,p.tail+.18),.12,p.foundation.depth,
    middle,.013,z,foundationMat);
  footing.userData.kdSlidingFoundation=true;
  const foundationTop=frame(Math.max(.40,p.tail+.10),.028,
    p.foundation.depth+.03,middle,.070,z,foundationMat);
  foundationTop.userData.kdSlidingFoundationCap=true;
  // The CHANNEL is a HORIZONTAL U-profile seated on the concrete cap:
  // long steel web + two VERTICAL lips, all extending along the gate's X axis.
  // This is an illustrative cross-section, not a steelwork size calculation.
  const channel=new THREE.Group();
  channel.userData.kdSlidingChannel=true;
  channel.userData.kdSlidingChannelOrientation='horizontal-open-up';
  fixture.add(channel);
  const minRollerX=Math.min(...p.rollerPositions);
  const maxRollerX=Math.max(...p.rollerPositions);
  const channelFrom=Math.max(p.foundation.from,minRollerX-.20);
  const channelTo=Math.min(p.foundation.to,maxRollerX+.20);
  const channelLength=Math.max(.44,channelTo-channelFrom);
  const channelCenter=(channelFrom+channelTo)/2;
  const channelWeb=frameGeometry(channel,base,channelLength,.018,.25,
    baseX+channelCenter,.094,z,steelMat);
  channelWeb.userData.kdSlidingChannelWeb=true;
  for(const sign of [-1,1]){
    const flange=frameGeometry(channel,base,channelLength,.055,.018,
      baseX+channelCenter,.13,z+sign*.115,steelMat);
    flange.userData.kdSlidingChannelFlange=true;
  }

  // Two four-roller cantilever carriages: bolted steel base, raised brackets,
  // axles transverse to travel and side-by-side wheels INSIDE the guide beam.
  const wheelGeometry=new THREE.CylinderGeometry(.035,.035,.028,18);
  wheelGeometry.rotateX(Math.PI/2);
  ownedGeometries.push(wheelGeometry);
  for(let i=0;i<p.rollerPositions.length;i++){
    const xx=p.rollerPositions[i];
    const carriage=new THREE.Group();
    carriage.position.x=baseX+xx;
    carriage.position.z=z;
    carriage.userData.kdSlidingCarriage=true;
    carriage.userData.kdSlidingCarriageIndex=i;
    fixture.add(carriage);
    const foot=frameGeometry(carriage,base,.22,.022,.18,0,.12,0,steelMat);
    foot.userData.kdSlidingCarriageBase=true;
    // Side cheeks keep both wheel axles in a visible rigid carriage frame.
    for(const dz of [-.058,.058]){
      const cheek=frameGeometry(carriage,base,.19,.066,.014,0,.147,dz,steelMat);
      cheek.userData.kdSlidingCarriageBracket=true;
    }
    for(const dx of [-.064,.064]){
      for(const dz of [-.035,.035]){
        const wheel=new THREE.Mesh(wheelGeometry,wheelMat);
        wheel.position.set(dx,.17,dz);
        wheel.userData.kdSlidingRoller=true;
        carriage.add(wheel);
      }
      const axle=frameGeometry(carriage,base,.016,.016,.12,dx,.17,0,steelMat);
      axle.userData.kdSlidingCarriageAxle=true;
    }
    for(const dx of [-.085,.085]){
      const bolt=frameGeometry(carriage,base,.025,.015,.025,dx,.138,0,steelMat);
      bolt.userData.kdSlidingCarriageMount=true;
    }
  }
  // Receiver/catcher on the jamb opposite the parking pocket.
  const receiver= new THREE.Group();
  receiver.position.set(baseX+p.receiverX,0,z);
  receiver.userData.kdSlidingReceiver=true;
  fixture.add(receiver);
  for(const y of [.24,Math.max(.48,p.leafHeight*.84)]){
    frameGeometry(receiver,base,.16,.035,.17,0,y,0,steelMat);
    frameGeometry(receiver,base,.024,.17,.034,-.067,y,0,steelMat);
    frameGeometry(receiver,base,.024,.17,.034,.067,y,0,steelMat);
  }
  // Do not draw an additional upper guide assembly in the client 3D preview.
  // Previously its side-local coordinates were offset twice for standalone
  // gates, leaving a detached black part in the empty parking area.
  // Real-world upper guidance remains a mounting/detailing decision, not a
  // visible fabricated extra post or loose component in this visualization.
  // User-measured obstacles are STATIC, independent from the moving frame.
  // Red indicates overlap with the swept corridor, gray is an outside marker.
  const obstacles=new THREE.Group();
  obstacles.userData.kdSlidingObstacleCollection=true;
  group.add(obstacles);
  for(const item of p.obstacles){
    const blocked=p.collisions.some(c=>c.kind==='obstacle'&&c.id===item.id);
    const obstacle=new THREE.Group();
    obstacle.userData.kdSlidingObstacle=true;
    obstacle.userData.kdSlidingObstacleId=item.id;
    obstacle.userData.kdSlidingObstacleCollision=blocked;
    obstacle.position.set(baseX+item.offset+item.width/2,0,item.distance);
    obstacles.add(obstacle);
    const mat=blocked?warningMat:foundationMat;
    if(item.type==='tree'){
      const trunkGeometry=new THREE.CylinderGeometry(
        Math.min(.12,item.width*.20),Math.min(.16,item.width*.26),
        item.height*.73,10
      );
      ownedGeometries.push(trunkGeometry);
      const trunk=new THREE.Mesh(trunkGeometry,mat);
      trunk.position.y=item.height*.365;
      obstacle.add(trunk);
      const crownGeometry=new THREE.SphereGeometry(
        Math.min(item.width*.52,item.height*.32),10,8
      );
      ownedGeometries.push(crownGeometry);
      const crown=new THREE.Mesh(crownGeometry,mat);
      crown.scale.set(1,1.12,Math.max(.6,item.depth/Math.max(.1,item.width)));
      crown.position.y=item.height*.76;
      obstacle.add(crown);
    }else{
      const geometry=item.type==='pillar'?
        new THREE.CylinderGeometry(item.width/2,item.width/2,item.height,12):
        new THREE.BoxGeometry(item.width,item.height,item.depth);
      ownedGeometries.push(geometry);
      const mesh=new THREE.Mesh(geometry,mat);
      mesh.position.y=item.height/2;
      obstacle.add(mesh);
    }
  }
  return fixture;
}
