engine.IncludeFile("local://class.js"); // from jsmodules/lib

engine.ImportExtension("qt.core");
engine.ImportExtension("qt.gui");
engine.ImportExtension("qt.webkit");


// Globals
var _p = null;
var masterclient;
var mastercamera;
var fov = 38.5; // Field of vision (45 = default, 38.5 is good in one particular setup)
var sector = 0;
var voidentity = scene.GetEntityByName("Void");
var compass = new QPixmap();
var needle = new QPixmap();
var pixmap_arrow = new QPixmap();
var arrow = new QPixmap();
var angle = 0;
var panning = 0;
var compass_angle = 0;
var distance_to_north = 10000;
var proxy = new UiProxyWidget();
var proxy2 = new UiProxyWidget();
var mainWidget = new QWidget();
var widget1 = new QLabel();
var widget2 = new QLabel();
var widget3 = new QLabel();
var widget4 = new QLabel();
var widget5 = new QLabel();
var block_size = 0;
var block_a = new QGraphicsPolygonItem();
var block_b = new QGraphicsPolygonItem();
var arrow2 = new QGraphicsPolygonItem();
var mouselook = false;

var arrow3;
var x0, x1, z0, z1;
var north_x = 0;
var north_z = -1000;
var bearing = 0.0;
var deltaInDegrees = 0.0;
var angleInDegrees = 0.0;
var previous_angleInDegrees = 0.0;
var bearingangle = 0.0;
var angle2 = 0.0;
var prev_angle = 0;
var direction = 0;
var altitude = 0;


var _g =
{
	connected : false,
	rotate :
	{
		sensitivity : 0.3
		//sensitivity : 1.0
	},
	move :
	{
		sensitivity : 10.0,
		//sensitivity : 20.0,
		amount : new float3(0,0,0)
	},
	motion : new float3(0,0,0),
};


var MasterClient = Class.extend
({
	init: function()
	{

		// Connect frame updates and enabled inputmapper
		frame.Updated.connect(this, this.Update);
		
		Log("**** Creating master client objects");

		this.clearScene();
		this.setInfoWidgetLayout();
		this.removeFreeLookCamera();
		this.createMasterClient();
		this.createArrow();
		this.setMasterCamera();
		this.setSpawnPoint();
		this.createInputHandler();
		this.drawCompass();
		this.showInfoWidgetDefaultValues();
		//this.helpWidget();
		
		// Signals
		voidentity.Action("ChangeForwardDirectionMsg").Triggered.connect(this, this.ChangeForwardDirection);
		voidentity.Action("MoveCamerasMsg").Triggered.connect(this, this.MoveCameras);
		voidentity.Action("ResetCamerasMsg").Triggered.connect(this, this.ResetCameras);
		voidentity.Action("LetterBoxMsg").Triggered.connect(this, this.LetterBox);
		voidentity.Action("_MSG_MOVING_MODE").Triggered.connect(this, this.LetterBox);
		ui.GraphicsScene().sceneRectChanged.connect(this, this.windowResized);
        masterclient.placeable.AttributeChanged.connect(this, this.ParentEntityRefChanged);	
	},
	
	clearScene: function()
	{
		var ui_item = ui.GraphicsScene().items();
		for (var i=0; i < ui_item.length; i++)
		//	ui.GraphicsScene().removeItem(ui_item[i]);
		{
			if (ui_item[i].type() == 7)
			{
				ui.GraphicsScene().removeItem(ui_item[i]);
				Log("**** Removed: " +ui_item[i]);
			}
		} 
		var oldarrow = scene.GetEntityByName("Arrow");
		if (oldarrow)
		{
			scene.RemoveEntity(oldarrow.id,'');
			Log("**** Old Arrow entity removed");
		}		
	},
	
	
	showInfoWidgetDefaultValues: function()
	{
		widget1.text = "Client1 (MasterClient)";
		widget2.text = "Azimuth: " +angle2.toFixed(2);
		widget3.text = "Direction of travel: " +direction;		
		widget4.text = "Sector: "+sector;
		widget5.text = "Altitude: "+voidentity.placeable.transform.pos.y;//.toFixed(2);
		//widget5.text = "Field of vision: "+fov.toFixed(2);
	},
	
	createArrow: function()
	{
		arrow3 = scene.CreateLocalEntity(["EC_Placeable", "EC_Mesh", "EC_Name"]);
		arrow3.SetName("Arrow");
		arrow3.mesh.meshRef = "assets/Arrow.mesh";
		var mats = arrow3.mesh.meshMaterial;
		mats[0] = "assets/Metal.material";
		arrow3.mesh.meshMaterial = mats; 
		arrow3.placeable.SetParent(voidentity, preserveWorldTransform=false);
		arrow3.placeable.SetPosition(0,-0.9,-3);
		var trans = arrow3.placeable.transform;
		trans.rot.y = -90;
		trans.scale.x = 0.1;
		trans.scale.z = 0.1;
		trans.scale.y = 0.01;
		arrow3.placeable.transform = trans;
	},
	
	ParentEntityRefChanged: function(attribute)
	{
		widget4.text = attribute.name;
		if (attribute.name === "Parent entity ref")
		{
			voidentity.Exec(4, "ChangeParentEntityRefMsg", attribute.value);
			widget2.text = "Parent entity reference: " + (scene.GetEntityRaw(attribute.value)).name;
		}
	},
	
	setInfoWidgetLayout: function()
	{
		var layout = new QVBoxLayout();
		mainWidget.setLayout(layout);
		mainWidget.setFixedWidth(250);
		layout.addWidget(widget1, 0, 1);
		layout.addWidget(widget2, 0, 1);
		layout.addWidget(widget3, 0, 1);
		layout.addWidget(widget4, 0, 1);
		layout.addWidget(widget5, 0, 1);
		layout.setContentsMargins(10,0,10,5);
		layout.setSpacing(2);
		proxy = ui.AddWidgetToScene(mainWidget);
		//mainWidget.setStyleSheet("QLabel {background-color: transparent; color: black; font-size: 16px; opacity: 0,2;}");
		mainWidget.setStyleSheet("QLabel {color: black; font-size: 14px;}");
		widget1.setStyleSheet("QLabel {color: blue; font-size: 18px; font-weight: bold;}");
		rect = ui.GraphicsScene().sceneRect;
		proxy.windowFlags = 0;
		proxy.visible = true;
		proxy.y = 10;
		proxy.x = rect.width()-mainWidget.width-10;
		mainWidget.setWindowOpacity(0.3);
	},
	
	helpWidget: function()
	{
		var helpLabel = new QLabel();
		helpLabel.text = 
			"KEYBOARD COMMANDS\n\
			\nW/S/A/D		Move forward/backward/left/right\
			\nSPACE/C	Move up/down\
			\nNumpad +	Change direction of travel to the next sector\
			\nNumpad -	Change direction of travel to the previous sector\
			\nNumpad 8/9	Minor/Major increase vertical FOV\
			\nNumpad 5/6	Minor/Major decrease vertical FOV\
			\nNumpad 7/4	Move cameras forward/backward\
			\nR		Reset to initial state\
			\nH		Show/hide this help\
			\nQ		Show/hide all widgets\
			";
		proxy2 = new UiProxyWidget(helpLabel);
		helpLabel.setStyleSheet("QLabel {background-color: white; color: black; font-size: 16px; margin: 10px;}");
		helpLabel.setFixedWidth(500);
		helpLabel.setFixedHeight(260);
		proxy2.windowFlags = 0;
		proxy2.y = 50;
		proxy2.x = 300;		
		ui.AddProxyWidgetToScene(proxy2);
		proxy2.visible = true;
	},
	
	LetterBox: function(size) 
	{
		ui.GraphicsScene().removeItem(block_a);
		ui.GraphicsScene().removeItem(block_b);
		if (size!=0)
		{
			var color = new QColor("black");
			var mainwin = ui.MainWindow();
			var height = mainwin.size.height();
			var width = mainwin.size.width();
			
			var point_a1 = new QPointF(0,0);
			var point_a2 = new QPointF(size,0);
			var point_a3 = new QPointF(size,height);
			var point_a4 = new QPointF(0,height);
			var points_a = new Array(point_a1, point_a2, point_a3, point_a4);
			var qpoly_a = new QPolygon(points_a);
			var poly_a = new QPolygonF(qpoly_a);
			
			var point_b1 = new QPointF(width,0);
			var point_b2 = new QPointF(width-size,0);
			var point_b3 = new QPointF(width-size,height);
			var point_b4 = new QPointF(width,height);
			var points_b = new Array(point_b1, point_b2, point_b3, point_b4);
			var qpoly_b = new QPolygon(points_b);
			var poly_b = new QPolygonF(qpoly_b);
			
			block_a = new QGraphicsPolygonItem(poly_a, 0, scene);	
			block_b = new QGraphicsPolygonItem(poly_b, 0, scene);	
			block_a.setBrush(color);
			block_b.setBrush(color);
			block_a.setOpacity(1.0);
			block_b.setOpacity(1.0);
			ui.GraphicsScene().addItem(block_a);
			ui.GraphicsScene().addItem(block_b);
		}
	},
	
	MoveCameras: function(param)
	{
		trans = masterclient.placeable.transform;
		var radians = sector*60*Math.PI/180;

		if (param == "forward") 
		{
			trans.pos.z -= Math.cos(radians);    
			trans.pos.x += Math.sin(radians);    
			masterclient.placeable.transform = trans;
		}
		else if (param == "backward") 
		{
			trans.pos.z += Math.cos(radians);    
			trans.pos.x -= Math.sin(radians);    
			masterclient.placeable.transform = trans; 
		}
		widget2.text = "Camera new z position: "+(-trans.pos.z);
		mastercamera.SetActive();
	},
	
	ResetCameras: function()
	{
		//var camera = scene.GetEntityByName("ClientCamera");
		//trans = camera.placeable.transform;
		trans = masterclient.placeable.transform;
		trans.pos.z = 0;
		trans.pos.x = 0;
		masterclient.placeable.transform = trans; 
		mastercamera.SetActive();
		//debug("Z: "+(-trans.pos.z));
		widget2.text = "Cameras' positions reseted";
	},
	
	ChangeForwardDirection: function(sector)
	{
		ui.GraphicsScene().removeItem(arrow);
		var ID = parseInt(sector)+1;
		if (ID == 1) // if MasterClient
		{
			this.drawForwardIndicator();
			widget2.text = "Direction of travel";
		}
		else
			widget2.text = "Direction of travel: client"+ID;
	},
	
	windowResized: function(rect)
	{
		if (!arrow.isNull)
			arrow.setPos(rect.width()/2-(135/2),rect.height()-pixmap_arrow.height());
		proxy.x = rect.width()-mainWidget.width-10;
	},
	
	WindowResizeListener: function(widg, callbackFunction)
	{
		widg.WindowResized = callbackFunction;
		var gscene = ui.GraphicsScene().scene();
		gscene.sceneRectChanged.connect(widg, widg.WindowResized);		
	},
	
	Update: function(frametime)
	{
		profiler.BeginBlock("FreeLookCamera_Update");

		if (_g.move.amount.x == 0 && _g.move.amount.y == 0 && _g.move.amount.z == 0)
		{
			profiler.EndBlock();
			return;
		}

		_g.motion.x = _g.move.amount.x * _g.move.sensitivity * frametime;
		_g.motion.y = _g.move.amount.y * _g.move.sensitivity * frametime;
		_g.motion.z = _g.move.amount.z * _g.move.sensitivity * frametime;
		
		_g.motion = voidentity.placeable.Orientation().Mul(_g.motion);
		voidentity.placeable.SetPosition(voidentity.placeable.Position().Add(_g.motion));

		profiler.EndBlock();
	},

	// Create MasterClient-entity which gives placeable data for the clients
	createMasterClient: function()
	{
		masterclient = scene.CreateLocalEntity(["EC_Placeable", "EC_Camera", "EC_Name"]);
		masterclient.SetName("MasterCamera");
		masterclient.SetTemporary(true);
		var placeable = masterclient.placeable;
		
		// set parenting reference to the Server's Void-entity
		placeable.SetParent(voidentity, preserveWorldTransform=false);
		
		Log("**** MasterClient entity has been created with placeable, camera and name components");
	},

	// Set MasterCamera parameters
	setMasterCamera: function()
	{
		mastercamera = masterclient.camera;
		mastercamera.verticalFov = fov;
		mastercamera.SetActive();
	},
	
	// Set initial spawn point
	setSpawnPoint: function()
	{
		var void_placeable = voidentity.placeable;
		var void_transform = void_placeable.transform;
		void_transform.pos = new float3(0, 20, 0);
		voidentity.placeable.transform = void_transform;
	},
	
	// Create handler for keyboard and mouse events
	createInputHandler: function()
	{
		var inputContext = input.RegisterInputContextRaw("FreeLookCamera", 101);
		inputContext.takeMouseEventsOverQt = true;
		inputContext.KeyPressed.connect(this, this.HandleKeyPress);
		inputContext.KeyReleased.connect(this, this.HandleKeyRelease);
		inputContext.MouseEventReceived.connect(this, this.HandleMouse);
		Log("**** InputHandler initialized...");
	},
	
	// Handler for key press commands 
	HandleKeyPress: function(e)
	{
	
		var pos1 = voidentity.placeable.WorldPosition();
		//var radians = (sector)*60*Math.PI/180;
		//var radians2 = (Math.abs(panning)/(rect.width()/2))*60*Math.PI/180;
		var radians2 = (direction)*Math.PI/180;
		previous_angleInDegrees = angle2;
		
		widget5.text = "ZX-coordinates: "+voidentity.placeable.WorldPosition().z.toFixed(2) + ", " +voidentity.placeable.WorldPosition().x.toFixed(2);

		// forward
		if (e.keyCode == Qt.Key_W)
		{
			_g.move.amount.z = -Math.cos(radians2);
			_g.move.amount.x = Math.sin(radians2);

		}
		
		// backward
		else if (e.keyCode == Qt.Key_S)
		{
			_g.move.amount.z = Math.cos(radians2);
			_g.move.amount.x = -Math.sin(radians2);
		}
		
		// right
		else if (e.keyCode == Qt.Key_D)
		{
			_g.move.amount.z = Math.sin(radians2);
			_g.move.amount.x = Math.cos(radians2);
		}
		
		// left
		else if (e.keyCode == Qt.Key_A)
		{
			_g.move.amount.z = -Math.sin(radians2);
			_g.move.amount.x = -Math.cos(radians2);
		}
		
		// up
		else if (e.keyCode == Qt.Key_Space)
		{
			_g.move.amount.y = 1;
			widget5.text = "Altitude: "+voidentity.placeable.transform.pos.y.toFixed(2);
		}
		
		// down
		else if (e.keyCode == Qt.Key_C)
		{
			_g.move.amount.y = -1;
			widget5.text = "Altitude: "+voidentity.placeable.transform.pos.y.toFixed(2);
		}
		
		// change sector +
		else if (e.modifiers & Qt.KeypadModifier && e.keyCode == Qt.Key_Plus)
		{
			if (direction == Math.ceil(direction/60)*60)
				direction += 60;
			else
				direction = Math.ceil(direction/60)*60;
			if (direction > 300)
				direction = 0;
			var trans = arrow3.placeable.transform;
			trans.rot.y = -90-direction;
			arrow3.placeable.transform = trans;
			sector = direction/60+1;	
			//voidentity.Exec(5, "ChangeForwardDirectionMsg", sector);
			voidentity.Exec(5, "_MSG_ROTATE_ARROW_", direction);
			widget3.text = "Direction of travel: " +direction;		
			widget4.text = "Sector: "+sector;
		}
		
		// change sector -
		else if (e.modifiers & Qt.KeypadModifier && e.keyCode == Qt.Key_Minus)
		{
			if (direction == Math.floor(direction/60)*60)
				direction -= 60;
			else
				direction = Math.floor(direction/60)*60;
			if (direction < 0)
				direction = 300;
			var trans = arrow3.placeable.transform;
			trans.rot.y = -90-direction;
			arrow3.placeable.transform = trans;			
			//voidentity.Exec(5, "ChangeForwardDirectionMsg", sector);
			sector = direction/60+1;	
			voidentity.Exec(5, "_MSG_ROTATE_ARROW_", direction);
			widget3.text = "Direction of travel: " +direction;		
			widget4.text = "Sector: "+sector;
		}
		
		// major increase vertical fov
		else if (e.modifiers & Qt.KeypadModifier && e.keyCode == Qt.Key_9)
		{
			fov += 1.0;
			mastercamera.verticalFov = fov;
			widget5.text = "Field of vision: "+fov.toFixed(2);
			voidentity.Exec(4, "ChangeFovMsg", fov);	// 4=peers
		}
		
		// minor increase vertical fov
		else if (e.modifiers & Qt.KeypadModifier && e.keyCode == Qt.Key_8)
		{
			fov += 0.05;
			mastercamera.verticalFov = fov;
			widget5.text = "Field of vision: "+fov.toFixed(2);
			voidentity.Exec(4, "ChangeFovMsg", fov);
		}		
		
		// major decrease vertical fov
		else if (e.modifiers & Qt.KeypadModifier && e.keyCode == Qt.Key_6)
		{
			fov -= 1.0;
			mastercamera.verticalFov = fov;
			widget5.text = "Field of vision: "+fov.toFixed(2);
			voidentity.Exec(4, "ChangeFovMsg", fov);
		}
		
		// minor decrease vertical fov
		else if (e.modifiers & Qt.KeypadModifier && e.keyCode == Qt.Key_5)
		{
			fov -= 0.05;
			mastercamera.verticalFov = fov;
			widget5.text = "Field of vision: "+fov.toFixed(2);
			voidentity.Exec(5, "ChangeFovMsg", fov);
		}			

		// Reset initial state
		else if (e.keyCode == Qt.Key_R)
		{
			this.setSpawnPoint();
			angle2 = 0;
			direction = 0;
			var trans = arrow3.placeable.transform;
			trans.rot.y = -90;
			arrow3.placeable.transform = trans;
			this.showInfoWidgetDefaultValues();
		}
		
		// Move cameras forward
		else if (e.modifiers & Qt.KeypadModifier && e.keyCode == Qt.Key_n)
			voidentity.Exec(5, "MoveCamerasMsg", "forward");
		
		// Move cameras backward
		else if (e.modifiers & Qt.KeypadModifier && e.keyCode == Qt.Key_PageDown)
			voidentity.Exec(5, "MoveCamerasMsg", "backward");
		
		
		// Reset cameras positions
		else if (e.keyCode == Qt.Key_N)
			voidentity.Exec(5, "ResetCamerasMsg");
		
		
		// Increase black block size
		else if (e.keyCode == Qt.Key_L)
		{
			block_size += 5;
			voidentity.Exec(5, "LetterBoxMsg", block_size);
		}

		// Reset black block size
		else if (e.keyCode == Qt.Key_K)
		{
			block_size = 0;
			voidentity.Exec(5, "LetterBoxMsg", block_size);
		}

		// Moving mode: mode1
		else if (e.keyCode == Qt.Key_1)
			voidentity.Exec(5, "_MSG_MOVING_MODE", "mode1");

		// Moving mode: mode2
		else if (e.keyCode == Qt.Key_2)
			voidentity.Exec(5, "_MSG_MOVING_MODE", "mode2");
		
		// Show/hide all widgets and extra graphics
		else if (e.keyCode == Qt.Key_Q)
		{
			if (proxy.visible == true)
			{
				proxy.visible = false;
				proxy2.visible = false;
				compass.hide();
				needle.hide();
				arrow3.mesh.RemoveMesh();
				voidentity.Exec(4, "_MSG_TOGGLE_WIDGETS_", "HIDE");
			}
			else
			{
				proxy.visible = true;
				compass.show();
				needle.show();
				arrow3.mesh.meshRef = "assets/Arrow.mesh";
				voidentity.Exec(4, "_MSG_TOGGLE_WIDGETS_", "SHOW");
			}
		}
		
		// Show/hide help widget
		else if (e.keyCode == Qt.Key_H)
		{
			if (proxy2.visible == true)
				proxy2.visible = false;
			else
				proxy2.visible = true;
		}
		
		x0 = voidentity.placeable.WorldPosition().x;
		z0 = voidentity.placeable.WorldPosition().z;
		var deltaX = north_x - x0;
		var deltaZ = z0 - north_z; // Z-axis goes down so deltaZ calculation has to be reserved
		angleInDegrees = -90 + Math.atan2(deltaZ, deltaX) * 180 / Math.PI;
		deltaInDegrees = angleInDegrees - previous_angleInDegrees;
		compass.setRotation(-angle2);
		widget2.text = "Azimuth: " +angle2.toFixed(2);
		
		//widget1.text = e.keyCode;
	},
	
	// Handler for key release commands
	HandleKeyRelease: function(e)
	{
	if (e.keyCode == Qt.Key_W && _g.move.amount.z != 0 )
		_g.move.amount = new float3(0,0,0);
	
	else if (e.keyCode == Qt.Key_S && _g.move.amount.z != 0)
		_g.move.amount = new float3(0,0,0);
	
	else if (e.keyCode == Qt.Key_D && _g.move.amount.x != 0)
		_g.move.amount = new float3(0,0,0);
		
	else if (e.keyCode == Qt.Key_A && _g.move.amount.x != 0)
		_g.move.amount = new float3(0,0,0);
	
	else if (e.keyCode == Qt.Key_Space && _g.move.amount.y != 0)
		_g.move.amount = new float3(0,0,0);
		
	else if (e.keyCode == Qt.Key_C && _g.move.amount.y != 0)
		_g.move.amount = new float3(0,0,0);
	},

	// Handler for mouse events
	HandleMouse: function(e)
	{
		if (e.IsButtonDown(2) && !input.IsMouseCursorVisible())
		{
			mouselook = true;
			if (e.relativeX != 0)
				this.HandleMouseLookX(e.relativeX);
			if (e.relativeY != 0)
				this.HandleMouseLookY(e.relativeY);
		}
		else if (e.IsButtonDown(1))
			this.HandleMousePan(e.relativeX)
		
		else if (e.GetEventType() == 4)
			mouselook = false;
	},

	// Handler for mouse x axis relative movement
	HandleMouseLookX: function(param)
	{
		var transform = voidentity.placeable.transform;
		transform.rot.y -= _g.rotate.sensitivity * parseInt(param);
		voidentity.placeable.transform = transform;
		bearing = (-(transform.rot.y)%360);
		angle2 = bearing;
		compass.setRotation(-angle2);
		widget2.text = "Azimuth: " +angle2.toFixed(2);
	},

	// Handler for mouse y axis relative movement
	HandleMouseLookY: function(param)
	{
		var transform = voidentity.placeable.transform;
		var radians = (sector-1)*60*Math.PI/180;
		transform.rot.x -= _g.rotate.sensitivity * parseInt(param);
		if (transform.rot.x > 90.0)
			transform.rot.x = 90.0;
		if (transform.rot.x < -90.0)
			transform.rot.x = -90.0;
		voidentity.placeable.transform = transform;
	},
	
	HandleMousePan: function(param)
	{
		var increase = param/rect.width()*60;
		var increase = param/rect.width()*120;
		if (param < 0 && direction+increase < 10 && direction+increase > 0)	// snap to zero
			direction = 0;
		else if (param > 0 && direction+increase > 350)						// snap to zero
			direction = 0;
		else if (direction+increase < 0)
			direction = 360+increase;
		else if (direction+increase > 360)
			direction = increase;
		else
			direction = direction+increase;
		widget3.text = "Direction of travel: " +direction.toFixed(2);
		var trans = arrow3.placeable.transform;
		trans.rot.y = -90-direction;
		arrow3.placeable.transform = trans;
		voidentity.Exec(5, "_MSG_ROTATE_ARROW_", direction);
	},
	
	drawCompass: function()
	{
		var pixmap_compass = new QPixmap(asset.GetAsset("compassd.png").DiskSource());
		var pixmap_needle = new QPixmap(asset.GetAsset("needle.png").DiskSource());
		compass = ui.GraphicsScene().addPixmap(pixmap_compass);
		needle = ui.GraphicsScene().addPixmap(pixmap_needle);
		compass.setTransformOriginPoint(pixmap_compass.width()/2, pixmap_compass.height()/2);
	},
	
	drawForwardIndicator: function(angle)
	{
		pixmap_arrow = new QPixmap(asset.GetAsset("arrow3b.png").DiskSource());
		arrow = ui.GraphicsScene().addPixmap(pixmap_arrow);
		rect = ui.GraphicsScene().sceneRect;
		arrow.setPos(rect.width()/2-(135/2),rect.height()-pixmap_arrow.height());
		///arrow.setTransformOriginPoint(pixmap_arrow.width()/2, pixmap_arrow.height());
		arrow.setTransformOriginPoint(pixmap_arrow.width()/2, (pixmap_arrow.height())*4);
	},
	
	// Remove FreeLookCamera from the scene
	removeFreeLookCamera: function()
	{
		var freelookcamera = scene.GetEntityByName("FreeLookCamera");
		
		if (freelookcamera)
		{
			scene.RemoveEntity(freelookcamera.id,'');
			Log("**** FreeLookCamera entity removed");
		}
	}
});

// Startup
_p = new MasterClient();

// EOF
