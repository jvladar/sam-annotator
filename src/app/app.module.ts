import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { MainCanvasComponent } from './main-canvas/main-canvas.component';
import { Ng2PanZoomModule } from 'ng2-panzoom';
import {NgbModule} from '@ng-bootstrap/ng-bootstrap';
import { NgxUiLoaderModule } from 'ngx-ui-loader';
import { HttpClientModule } from '@angular/common/http';
import { MenuBarComponent } from './menu-bar/menu-bar.component';
import { MenuColorSelectorComponent } from './menu-color-selector/menu-color-selector.component';
import { MenuImageSelectorComponent } from './menu-image-selector/menu-image-selector.component';
import { AnnotationsComponent } from './annotations/annotations.component';
import {FormsModule} from "@angular/forms";
import {SamComponent} from './sam/sam.component';
import {DatePipe} from "@angular/common";
import { MymodalComponent } from './mymodal/mymodal.component';
import { ProjectManagerComponent } from './project-manager/project-manager.component';



@NgModule({
  declarations: [
    AppComponent,
    MainCanvasComponent,
    MenuBarComponent,
    MenuColorSelectorComponent,
    MenuImageSelectorComponent,
    AnnotationsComponent,
    SamComponent,
    MymodalComponent,
    ProjectManagerComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    Ng2PanZoomModule,
    NgbModule,
    NgxUiLoaderModule,
    HttpClientModule,
    FormsModule,
  ],
  providers: [DatePipe],
  bootstrap: [AppComponent]
})
export class AppModule { }
