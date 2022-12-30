/**
 * Non-jQuery Menu Editor
 * @author David Ticona Saravia https://github.com/davicotico (2020, original developer)
 * @author Michael Martín Moro https://github.com/Plaristote (2022, refactoring, removing jQuery dependencies)
 * @version 1.0.0
 * */
module.exports = function MenuEditor(mainElement, options) {
  const self = this;
  var $main = typeof mainElement == "string" ? document.querySelector("#" + mainElement) : mainElement;
  $main.dataset.level = "0";
  var settings = {
    onChanged: function() {},
    labelEdit: '<i class="fas fa-edit clickable"></i>',
    labelRemove: '<i class="fas fa-trash-alt clickable"></i>',
    labelMoveUp: '<i class="fas fa-angle-up clickable"></i>',
    labelMoveDown: '<i class="fas fa-angle-down clickable"></i>',
    textConfirmDelete: 'This item will be deleted. Are you sure?',
    //iconPicker: { cols: 4, rows: 4, footer: false, iconset: "fontawesome5" },
    maxLevel: -1,
    buttonGroupClass: "pure-button-group",
    secondaryButtonClass: "pure-button pure-sm-button",
    primaryButtonClass: "pure-button pure-button-primary pure-sm-button",
    dangerButtonClass: "pure-button pure-button-danger pure-sm-button",
    listOptions: {
      hintCss: { border: '1px dashed #13981D'},
      opener: {
        as: 'html',
        close: '<i class="fas fa-minus"></i>',
        open: '<i class="fas fa-plus"></i>',
        openerClass: 'pure-button pure-button-add pure-sm-button opener',
      },
      listsClass: "pl-0"
    }
  };
  if (options.listOptions) {
    for (const key in options.listOptions)
      settings.listOptions[key] = options.listOptions[key];
    delete options.listOptions;
  }
  for (const key in options)
    settings[key] = options[key];
  var itemEditing = null;
  var sortableReady = true;
  var form = null;
  var updateButton = null;
  var addButton = null;
  var inputsContainer = null;
  //var iconPickerOpt = settings.iconPicker;
  var options = settings.listOptions;
  //var iconPicker = $('#'+$main.id+'_icon').iconpicker(iconPickerOpt);
  //$($main).sortableLists(settings.listOptions);

  /* EVENTS */
  //iconPicker.on('change', function (e) {
  //  form.querySelector("[name=icon]").value = e.icon;
  //});

  const buttonEvents = {
    ".btnRemove": function(event, button, listItem, list) {
      if (confirm(settings.textConfirmDelete)) {
        let isMainContainer = false;
        listItem.remove();
        if (list.id !== undefined)
          isMainContainer = list == $main;
        if (list.children.length == 0 && !isMainContainer) {
          let div = list.previousSibling;
          div.querySelector(".sortableListsOpener").remove();
          list.remove();
        }
        self.updateButtons($main);
        settings.onChanged();
      }
    },

    ".btnEdit": function(event, button, listItem, list) {
      itemEditing = listItem;
      editItem(itemEditing);
    },

    ".btnUp": function(event, button, listItem, list) {
        list.insertBefore(listItem, listItem.previousSibling);
        self.updateButtons($main);
        settings.onChanged();
    },

    ".btnDown": function(event, button, listItem, list) {
      list.insertBefore(listItem, listItem.nextSibling.nextSibling);
      self.updateButtons($main);
      settings.onChanged();
    },

    ".btnIn": function(event, button, listItem, list) {
      const predecessor = listItem.previousSibling;
      if (!isValidLevel(listItem, predecessor))
        return false;
      if (predecessor != null) {
        let subMenu = predecessor.querySelector("ul");
        if (!subMenu) {
          subMenu = document.createElement("ul");
          subMenu.classList.add(settings.listOptions.listsClass);
          predecessor.appendChild(subMenu);
          predecessor.classList.add("sortableListsOpen");
          TOpener(predecessor);
        }
        subMenu.appendChild(listItem);
      }
      self.updateButtons($main);
      updateDepths($main);
      settings.onChanged();
    },

    ".btnOut": function(event, button, listItem, list) {
      const parentListItem = list.parentElement;
      parentListItem.parentElement.insertBefore(listItem, parentListItem.nextSibling);
      if (list.children.length <= 0) {
        const label = list.previousSibling;
        label.removeChild(label.querySelector(".sortableListsOpener"));
        list.parentElement.removeChild(list);
      }
      self.updateButtons($main);
      updateDepths($main);
      settings.onChanged();
    }
  };

  function initializeButtons(buttonGroup) {
    for (const selector in buttonEvents) {
      const button = buttonGroup.querySelector(selector);
      if (button) {
        button.addEventListener("click", function(event) {
          event.preventDefault();
          const listItem = buttonGroup.parentElement.parentElement;
          const list = listItem.parentElement;
          buttonEvents[selector](event, button, listItem, list);
          return false;
        });
      }
    }
  }

  /* PRIVATE METHODS */
  function toggleSubMenu(listItem, setting, options) {
    let opener;

    opener = listItem.querySelector("div").querySelector(".sortableListsOpener");
    listItem.classList.remove(options.removedClass);
    listItem.classList.add(options.addedClass);
    listItem.querySelector("ul").style.display = options.deployButtonDisplay;
    if (setting.opener.as == "html")
      opener.innerHTML = options.opener.innerHTML;
    else if (setting.opener.as === "class") {
      options.opener.addClass.split(' ').forEach(function(addClass) {
        if (addClass.length) opener.classList.add(addClass);
      });
      options.opener.banClass.split(' ').forEach(function(banClass) {
        if (banClass.length) opener.classList.remove(banClass);
      });
    }
  }

  function deploySubMenu(listItem, setting) {
    toggleSubMenu(listItem, setting, {
      removedClass: "sortableListsClosed",
      addedClass: "sortableListsOpen",
      deployButtonDisplay: "block",
      opener: {
        innerHTML: setting.opener.close,
        addClass: setting.opener.close,
        banClass: setting.opener.open
      }
    });
  }

  function closeSubMenu(listItem, setting) {
    toggleSubMenu(listItem, setting, {
      removedClass: "sortableListsOpen",
      addedClass: "sortableListsClosed",
      deployButtonDisplay: "none",
      opener: {
        innerHTML: setting.opener.open,
        addClass: setting.opener.open,
        banClass: setting.opener.close
      }
    });
  }

  function toJson(list) {
    const array = [];

    for (let i = 0 ; i < list.children.length ; ++i) {
      const listItem = list.children[i];
      const subMenu = listItem.querySelector("ul");
      const object = {};

      for (const key in listItem.dataset)
        object[key] = listItem.dataset[key];
      if (subMenu)
        object.children = toJson(subMenu);
      else
        delete object.children;
      array.push(object);
    }
    return array;
  }

  function updateDepths(el, depth) {
    let level = depth !== undefined ? 0 : depth;

    for (let i = 0 ; i < el.children.length ; ++i) {
      let listItem = el.children[i];
      let submenu = el.querySelector(":scope > ul");

      if (submenu) {
        submenu.dataset["level"] = level + 1;
        updateDepths(submenu, level + 1);
      }
    }
  }

  /**
    * @description Update the buttons at the nested list (the main <ul>).
    * the buttons are: up, down, item in, item out
    * @param {int} depth
    */
  function updateButtons(list, depth) {
    const level = depth === undefined ? 0 : depth;
    const removeFirst = ['Up', 'In'];
    const removeLast = ['Down'];

    if (level === 0) {
      removeFirst.push("Out");
      removeLast.push("Out");
      for (let i = 0 ; i < list.children.length ; ++i) {
        hideButtons(list.children[i], ["Out"]);
      }
    }
    for (let i = 0 ; i < list.children.length ; ++i) {
      const listItem = list.children[i];
      const subList = listItem.querySelector("ul");
      if (subList)
        updateButtons(subList, level + 1);
    }
    if (list.children.length)
    {
      hideButtons(list.children[0], removeFirst);
      hideButtons(list.children[list.children.length - 1], removeLast);
    }
  }

  /**
    * @description Hide the buttons at the item <li>
    * @param {Array} buttons
    */
  function hideButtons(listItem, toRemoveList) {
    const buttonGroup = listItem.querySelector(".controls");
    if (!buttonGroup || !toRemoveList) return ;
    for (let i = 0 ; i < buttonGroup.children.length ; ++i) {
      const button = buttonGroup.children[i];
      for (let ii = 0 ; ii < toRemoveList.length ; ++ii) {
        if (button.classList.contains("btn" + toRemoveList[ii])) {
          button.style.display = "none";
          break ;
        }
      }
    }
  }

  function editItem(item) {
      for (const key in item.dataset) {
        const input = form.querySelector("[name=" + key + "]");
        if (input && input.tagName == "INPUT")
          input.value = item.dataset[key];
        else if (input)
          input.querySelector("[value=" + item.dataset[key] + "]").selected = true;
      }
      form.querySelector(".item-menu").focus();
      //iconPicker.iconpicker("setIcon", item.dataset.icon && item.dataset.icon.length > 0 ? item.dataset.icon : "empty");
      updateButton.disabled = false;
      settings.onChanged();
  }

  function resetForm() {
    inputsContainer.querySelectorAll("input").forEach(function(input) {
      input.value = "";
    });
    //iconPicker = iconPicker.iconpicker(iconPickerOpt);
    //iconPicker.iconpicker('setIcon', 'empty');
    updateButton.disabled = true;
    itemEditing = null;
  }

  function TButton(attr) {
    const button = document.createElement("button");
    attr.classCss.forEach(function(entry) { button.classList.add(entry); });
    button.classList.add("clickable");
    button.href = "#";
    button.innerHTML = attr.text;
    return button;
  }

  function TButtonGroup() {
    const buttonGroup = document.createElement("div");
    buttonGroup.classList.add("controls");
    buttonGroup.classList.add("float-right");
    settings.buttonGroupClass.split(' ').forEach(function(buttonGroupClass) {
      if (buttonGroupClass.length)
        buttonGroup.classList.add(buttonGroupClass);
    });
    buttonGroup.appendChild(TButton({classCss: settings.secondaryButtonClass.split(' ').concat(['btnIn', 'btnMove']), text: '<i class="fas fa-level-up-alt clickable"></i>'}));
    buttonGroup.appendChild(TButton({classCss: settings.secondaryButtonClass.split(' ').concat(['btnOut', 'btnMove']), text: '<i class="fas fa-level-down-alt clickable"></i>'}));
    buttonGroup.appendChild(TButton({classCss: settings.secondaryButtonClass.split(' ').concat(['btnDown', 'btnMove']), text: settings.labelMoveDown}));
    buttonGroup.appendChild(TButton({classCss: settings.secondaryButtonClass.split(' ').concat(['btnUp', 'btnMove']), text: settings.labelMoveUp}));
    buttonGroup.appendChild(TButton({classCss: settings.primaryButtonClass.split(' ').concat(['btnEdit']), text: settings.labelEdit}));
    buttonGroup.appendChild(TButton({classCss: settings.dangerButtonClass.split(' ').concat(['btnRemove']), text: settings.labelRemove}));
    initializeButtons(buttonGroup);
    return buttonGroup;
  }

  /**
    * @param {array} arrayItem Object Array
    * @param {int} depth Depth sub-menu
    * @return {object} jQuery Object
    **/
  function createMenu(arrayItem, depth) {
    const level = depth === undefined ? 0 : depth;
    let element = $main;

    if (level !== 0)
    {
      element = document.createElement("ul");
      element.classList.add(settings.listOptions.listsClass);
      element.dataset.level = level;
    }
    arrayItem.forEach(function (itemData) {
      const isParent = Array.isArray(itemData.children)
      const itemObject = {text: "", href: "", icon: "empty", target: "_self", title: ""};
      const listItem = self.createListItem();

      for (const key in itemData)
        itemObject[key] = itemData[key];
      for (const key in itemObject)
        listItem.dataset[key] = itemObject[key];
      listItem.querySelector("span.txt").textContent = listItem.dataset.text;
      element.appendChild(listItem);
      if (isParent)
        listItem.appendChild(createMenu(itemData.children, depth + 1));
    });
    return element;
  }

  function TOpener(li){
    const opener = document.createElement("span");
    const icon = document.createElement("i");
    const onTouched = function (event) {
      if (li.classList.contains("sortableListsClosed"))
        deploySubMenu(li, options);
      else
        closeSubMenu(li, options);
    };

    icon.innerHTML = settings.listOptions.opener.close;
    icon.className = icon.children[0].className;
    icon.innerHTML = "";
    opener.classList.add("sortableListsOpener");
    opener.appendChild(icon);
    opener.addEventListener("mousedown", onTouched);
    opener.addEventListener("touchstart", onTouched);
    options.opener.openerClass.split(' ').forEach(function(openerClass) {
      if (openerClass.length)
        opener.classList.add(openerClass);
    });
    li.children[0].insertBefore(opener, li.children[0].children[0]);
  }

  function setOpeners() {
    $main.querySelectorAll("li").forEach(function(listItem) {
      const subMenu = listItem.querySelector("ul");
      if (subMenu)
        TOpener(listItem);
    });
  }

  function isValidLevel($li, $liTarget) {
      if (settings.maxLevel < 0){
          return true;
      }
      var targetLevel = 0;
      var liCount = $li.querySelectorAll('ul').length;
      if ($liTarget)
        targetLevel = 0;
      else
        targetLevel = parseInt($liTarget.parentElement.dataset["level"]) + 1;
      console.log((targetLevel + liCount));
      return ((targetLevel + liCount)<=settings.maxLevel)
  }

  /* PUBLIC METHODS */
  this.setForm = function($form){
      form = $form;
  };

  this.getForm = function(){
      return form;
  };

  this.setInputContainer = function(value) {
    inputsContainer = value;
  };

  this.setUpdateButton = function(btn) {
      updateButton = btn;
      updateButton.disabled = true;
      itemEditing = null;
      updateButton.addEventListener("click", function() { self.update(); });
  };

  this.setAddButton = function(btn) {
    addButton = btn;
    addButton.addEventListener("click", function() { self.add(); });
  }

  this.getUpdateButton = function(){
      return updateButton;
  };

  this.getCurrentItem = function(){
      return itemEditing;
  };

  this.update = function(){
    const currentItem = this.getCurrentItem();
    if (currentItem !== null)
      this.updateItem(currentItem);
  };

  this.updateItem = function(item) {
    const oldIcon = item.dataset["icon"];
    const inputs = form.querySelectorAll(".item-menu");
    const icon = item.children[0].children[0];
    inputs.forEach(function(input) {
      let itemValue;
      if (input.tagName == "SELECT")
        itemValue = input.querySelector("option:checked").value
      else
        itemValue = input.value;
      item.dataset[input.name] = itemValue;
    });
    if (icon.tagName === "I") {
      (oldIcon || "").split(' ').forEach(function(iconClass) {
        if (iconClass.length)
          icon.classList.remove(iconClass);
      });
      (item.dataset.icon || "").split(' ').forEach(function(iconClass) {
        if (iconClass.length)
          icon.classList.add(iconClass);
      });
    }
    item.querySelector("span.txt").textContent = item.dataset.text;
    resetForm();
  }

  this.createListItem = function() {
    const textItem = document.createElement("span");
    const iconItem = document.createElement("i");
    const label    = document.createElement("div");
    const listItem = document.createElement("li");
    const btnGroup = TButtonGroup();

    listItem.classList.add("menu-editor-item");
    textItem.classList.add("txt");
    label.classList.add("menu-editor-label");
    label.appendChild(iconItem);
    label.appendChild(textItem);
    label.appendChild(btnGroup);
    listItem.appendChild(label);
    return listItem;
  }

  this.add = function(){
    const listItem = this.createListItem();

    $main.appendChild(listItem);
    this.updateItem(listItem);
    this.updateButtons();
    settings.onChanged();
  };
  /**
    * Data Output
    * @return String JSON menu scheme
    */
  this.getString = function () {
      var obj = toJson($main);
      return JSON.stringify(obj);
  };

  function stringToArray(str) {
      try {
          var obj = JSON.parse(str);
      } catch (err) {
          console.log('The string is not a json valid.');
          return null;
      }
      return obj;
  }
  /**
    * Data Input
    * @param {Array} Object array. The nested menu scheme
    */
  this.setData = function (strJson) {
    var arrayItem = (Array.isArray(strJson)) ? strJson : stringToArray(strJson);
    if (arrayItem !== null) {
      while ($main.lastChild) $main.removeChild($main.lastChild);
      createMenu(arrayItem);
      setOpeners();
      this.updateButtons();
    }
  };

  this.updateButtons = function () {
    $main.querySelectorAll(".btnMove").forEach(function(button) {
      button.style.display = "inline-block";
    });
    updateButtons($main);
  }
};

