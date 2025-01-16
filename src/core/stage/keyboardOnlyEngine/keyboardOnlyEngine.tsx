import { Direction } from "../../../types/directions";
import { Vector } from "../../dataStruct/Vector";
import { Camera } from "../Camera";
import { StageManager } from "../stageManager/StageManager";
import { ConnectableEntity } from "../../stageObject/StageObject";
import { Dialog } from "../../../utils/dialog";
import { editTextNode } from "../../controller/concrete/utilsControl";
import { SelectChangeEngine } from "./selectChangeEngine";

export namespace KeyboardOnlyEngine {
  let currentVirtualTargetLocation = Vector.getZero();

  export function virtualTargetLocation(): Vector {
    return currentVirtualTargetLocation;
  }

  export function init() {
    bindKeyEvents();
  }

  /**
   * 开始绑定按键事件
   * 仅在最开始调用一次
   */
  function bindKeyEvents() {
    console.log("bindKeyEvents");
    window.addEventListener("keydown", (event) => {
      if (event.key === "Tab") {
        if (isEnableVirtualCreate()) {
          createStart();
        }
      } else if (event.key === "i") {
        moveVirtualTargetByDirection(Direction.Up);
      } else if (event.key === "k") {
        moveVirtualTargetByDirection(Direction.Down);
      } else if (event.key === "j") {
        moveVirtualTargetByDirection(Direction.Left);
      } else if (event.key === "l") {
        moveVirtualTargetByDirection(Direction.Right);
      } else if (event.key === "Enter") {
        // 这个还必须在down的位置上，因为在up上会导致无限触发
        const selectedNode = StageManager.getTextNodes().find(
          (node) => node.isSelected,
        );
        if (!selectedNode) return;
        // 编辑节点
        editTextNode(selectedNode);
      } else {
        SelectChangeEngine.listenKeyDown(event);
      }
    });
    window.addEventListener("keyup", (event) => {
      if (event.key === "Tab") {
        if (isCreating()) {
          createEnd();
        }
      }
    });
  }

  /**
   * 是否达到了按下Tab键的前置条件
   */
  export function isEnableVirtualCreate(): boolean {
    // 确保只有一个节点被选中
    const selectConnectableEntities =
      StageManager.getConnectableEntity().filter((node) => node.isSelected);
    if (selectConnectableEntities.length !== 1) {
      return false;
    }
    return true;
  }

  let _isCreating = false;
  /**
   * 当前是否是按下Tab键不松开的情况
   * @returns
   */
  export function isCreating(): boolean {
    return _isCreating;
  }

  let lastDiffLocation = new Vector(200, 0);

  export function createStart(): void {
    if (isCreating()) {
      // 已经在创建状态，不要重复创建
      return;
    }
    _isCreating = true;
    // 记录上一次按下Tab键的时间
    lastPressTabTime = Date.now();
    // 计算并更新虚拟目标位置
    const selectConnectableEntities =
      StageManager.getConnectableEntity().filter((node) => node.isSelected);

    // 如果只有一个节点被选中，则生成到右边的位置
    if (selectConnectableEntities.length === 1) {
      currentVirtualTargetLocation = selectConnectableEntities[0].collisionBox
        .getRectangle()
        .rightCenter.add(lastDiffLocation);
    }
  }
  let lastPressTabTime = 0;

  /**
   * 返回按下Tab键的时间完成率，0-1之间，0表示刚刚按下Tab键，1表示已经达到可以松开Tab键的状态
   * @returns
   */
  export function getPressTabTimeInterval(): number {
    // 计算距离上次按下Tab键的时间间隔
    const now = Date.now();
    const interval = now - lastPressTabTime;
    return interval;
  }

  async function createEnd() {
    _isCreating = false;
    if (getPressTabTimeInterval() < 100) {
      Dialog.show({
        title: "松开Tab键过快💨",
        content:
          "按下Tab键的时间要在0.1秒以上，在松开Tab键之前，可以通过IKJL键移动虚拟目标位置。",
        type: "warning",
      });
      return;
    }
    // 获取当前选择的所有节点
    const selectConnectableEntities =
      StageManager.getConnectableEntity().filter((node) => node.isSelected);
    if (isTargetLocationHaveEntity()) {
      // 连接到之前的节点
      const entity = StageManager.findEntityByLocation(
        currentVirtualTargetLocation,
      );
      if (entity && entity instanceof ConnectableEntity) {
        // 连接到之前的节点
        for (const selectedEntity of selectConnectableEntities) {
          StageManager.connectEntity(selectedEntity, entity);
        }
        // 选择到新创建的节点
        entity.isSelected = true;
        // 取消选择之前的节点
        for (const selectedEntity of selectConnectableEntities) {
          selectedEntity.isSelected = false;
        }
        // 视野移动到新创建的节点
        Camera.location = currentVirtualTargetLocation.clone();
      }
    } else {
      // 更新diffLocation
      lastDiffLocation = currentVirtualTargetLocation
        .clone()
        .subtract(
          selectConnectableEntities[0].collisionBox.getRectangle().center,
        );
      // 创建一个新的节点
      const newNodeUUID = await StageManager.addTextNodeByClick(
        currentVirtualTargetLocation,
        [],
      );
      const newNode = StageManager.getTextNodeByUUID(newNodeUUID);
      if (!newNode) return;
      // 连接到之前的节点
      for (const entity of selectConnectableEntities) {
        StageManager.connectEntity(entity, newNode);
      }
      // 选择到新创建的节点
      newNode.isSelected = true;
      // 取消选择之前的节点
      for (const entity of selectConnectableEntities) {
        entity.isSelected = false;
      }
      // 视野移动到新创建的节点
      Camera.location = currentVirtualTargetLocation.clone();
      editTextNode(newNode);
    }
  }

  export function moveVirtualTarget(delta: Vector): void {
    currentVirtualTargetLocation = currentVirtualTargetLocation.add(delta);
  }

  export function cancelCreate(): void {
    // do nothing
    _isCreating = false;
  }

  /**
   * 是否有实体在虚拟目标位置
   * @returns
   */
  export function isTargetLocationHaveEntity(): boolean {
    const entities = StageManager.getConnectableEntity();
    for (const entity of entities) {
      if (entity.collisionBox.isContainsPoint(currentVirtualTargetLocation)) {
        return true;
      }
    }
    return false;
  }

  export function moveVirtualTargetByDirection(direction: Direction) {
    switch (direction) {
      case Direction.Up:
        moveVirtualTarget(new Vector(0, -100));
        break;
      case Direction.Down:
        moveVirtualTarget(new Vector(0, 100));
        break;
      case Direction.Left:
        moveVirtualTarget(new Vector(-100, 0));
        break;
      case Direction.Right:
        moveVirtualTarget(new Vector(100, 0));
        break;
      default:
        break;
    }
  }
}
