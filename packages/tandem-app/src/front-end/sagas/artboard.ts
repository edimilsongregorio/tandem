import { uncompressDocument, renderDOM, computedDOMInfo, ParentNode } from "slim-dom";
import { take, spawn, fork, select, call, put } from "redux-saga/effects";
import { Point, shiftPoint } from "aerial-common2";
import { delay, eventChannel } from "redux-saga";
import { Moved, MOVED, Resized, RESIZED } from "aerial-common2";
import { LOADED_SAVED_STATE, FILE_CONTENT_CHANGED, FileChanged, artboardLoaded, ARTBOARD_CREATED, ArtboardCreated, ArtboardMounted, ARTBOARD_MOUNTED, artboardDOMComputedInfo, artboardRendered, ARTBOARD_RENDERED, STAGE_TOOL_OVERLAY_MOUSE_PAN_END, StageToolOverlayMousePanning, STAGE_TOOL_OVERLAY_MOUSE_PANNING, artboardScroll, CANVAS_MOTION_RESTED, FULL_SCREEN_SHORTCUT_PRESSED } from "../actions";
import { getComponentPreview } from "../utils";
import { Artboard, Workspace, ApplicationState, getSelectedWorkspace, getArtboardById, getArtboardWorkspace, ARTBOARD,  getStageTranslate } from "../state";

const COMPUTE_DOM_INFO_DELAY = 500;
const VELOCITY_MULTIPLIER = 10;
const DEFAULT_MOMENTUM_DAMP = 0.1;
const MOMENTUM_THRESHOLD = 100;
const MOMENTUM_DELAY = 50;

export function* artboardSaga() {
  yield fork(handleLoadAllArtboards);
  yield fork(handleChangedArtboards);
  yield fork(handleCreatedArtboard);
  yield fork(handleArtboardRendered);
  yield fork(handleMoved);
  yield fork(handleResized);
  yield fork(handleScroll);
  yield fork(handleSyncScroll);
  yield fork(handleArtboardSizeChanges);
}

function* handleLoadAllArtboards() {
  while(1) {
    yield take(LOADED_SAVED_STATE);
    const state: ApplicationState = yield select();
    const workspace = getSelectedWorkspace(state);
    for (const artboard of workspace.artboards) {
      yield spawn(function*() {
        yield call(reloadArtboard, artboard.$id);
      });
    }
  }
}

function* handleChangedArtboards() {
  while(1) {
    const { filePath, publicPath }: FileChanged = yield take(FILE_CONTENT_CHANGED);

    const state: ApplicationState = yield select();
    const workspace = getSelectedWorkspace(state);

    for (const artboard of workspace.artboards) {
      if (artboard.dependencyUris.indexOf(filePath) !== -1) {
        yield call(reloadArtboard, artboard.$id);
      }
    }
  }
}

function* handleArtboardRendered() {
  while(1) {
    const { artboardId } = (yield take(ARTBOARD_RENDERED)) as ArtboardMounted;
    yield fork(function*() {
      const artboard = getArtboardById(artboardId, yield select());

      // delay for a bit to ensure that the DOM nodes are painted. This is a dumb quick fix that may be racy sometimes. 
      yield call(delay, COMPUTE_DOM_INFO_DELAY);
      yield call(recomputeArtboardInfo, artboard);
    });
  }
}

function* handleArtboardSizeChanges() {
  // handle full screen
  yield fork(function*() {
    while(1) {
      yield take([FULL_SCREEN_SHORTCUT_PRESSED, LOADED_SAVED_STATE, CANVAS_MOTION_RESTED]);
      const state: ApplicationState = yield select();
      const workspace = getSelectedWorkspace(state);
      
      // just reload everything for now
      for (const artboard of workspace.artboards) {
        yield call(recomputeArtboardInfo, artboard);
      }
    }
  })
}

function* recomputeArtboardInfo(artboard: Artboard) {
  yield put(artboardDOMComputedInfo(artboard.$id, computedDOMInfo(artboard.nativeNodeMap)));
}

function* reloadArtboard(artboardId: string) {
  yield spawn(function*() {

    // TODO - if state exists, then fetch diffs diffs instead
    const state: ApplicationState = yield select();
    const artboard = getArtboardById(artboardId, state);
    const [dependencyUris, compressedNode] = yield call(getComponentPreview, artboard.componentId, artboard.previewName, state);

    const doc = uncompressDocument([dependencyUris, compressedNode]);
    const mount = document.createElement("iframe");
    mount.setAttribute("style", `border: none; width: 100%; height: 100%`);
    const renderChan = eventChannel((emit) => {
      mount.addEventListener("load", () => {
        emit(renderDOM(doc, mount.contentDocument.body));
      });
      return () => {};
    });

    yield spawn(function*() {
      yield put(artboardRendered(artboardId, yield take(renderChan)));
    });

    yield put(artboardLoaded(artboard.$id, dependencyUris, doc as ParentNode, mount));
  });
}

function* handleCreatedArtboard() {
  while(1) {
    const { artboard }: ArtboardCreated = yield take(ARTBOARD_CREATED);
    yield call(reloadArtboard, artboard.$id);
  }
}

function* handleMoved() {
  while(1) {
    const { point }: Moved = yield take((action: Moved) => action.type === MOVED && action.itemType === ARTBOARD);
  }
}

function* handleResized() {
  const { bounds }: Resized = yield take((action: Resized) => action.type === RESIZED && action.itemType === ARTBOARD);
}

function* handleScroll() {
  let deltaTop  = 0;
  let deltaLeft = 0;
  let currentWindowId: string;
  let panStartScrollPosition: Point;

  let lastPaneEvent: StageToolOverlayMousePanning;

  function* scrollDelta(windowId, deltaY) {
    yield put(artboardScroll(windowId, shiftPoint(panStartScrollPosition, {
      left: 0,
      top: -deltaY
    })));
  }

  yield fork(function*() {
    while(true) {
      const event = lastPaneEvent = (yield take(STAGE_TOOL_OVERLAY_MOUSE_PANNING)) as StageToolOverlayMousePanning;
      const { artboardId, deltaY, center, velocityY: newVelocityY } = event;

      const zoom = getStageTranslate(getSelectedWorkspace(yield select()).stage).zoom;

      yield scrollDelta(artboardId, deltaY / zoom);
    }
  });
  yield fork(function*() {
    while(true) {
      yield take(STAGE_TOOL_OVERLAY_MOUSE_PAN_END);
      const { artboardId, deltaY, velocityY } = lastPaneEvent;

      const zoom = getStageTranslate(getSelectedWorkspace(yield select()).stage).zoom;
      
      yield spring(deltaY, velocityY * VELOCITY_MULTIPLIER, function*(deltaY) {
        yield scrollDelta(artboardId, deltaY / zoom);
      });
    }
  });
}

function* handleSyncScroll() {
  while(1) {
    yield take([STAGE_TOOL_OVERLAY_MOUSE_PANNING]);
    
  }
}

function* spring(start: number, velocityY: number, iterate: Function, damp: number = DEFAULT_MOMENTUM_DAMP, complete: Function = () => {}) {
  let i = 0;
  let v = velocityY;
  let currentValue = start;
  function* tick() {
    i += damp;
    currentValue += velocityY / (i / 1);
    if (i >= 1) {
      return complete();
    }
    yield iterate(currentValue);
    yield call(delay, MOMENTUM_DELAY);
    yield tick();
  }
  yield tick();
}
