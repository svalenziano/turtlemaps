export class UI {
    constructor() {
        fetch("./public/ui.html")
            .then(r => r.text())
            .then(console.log);
    }
}
export class SearchBox {
    $container;
    constructor($container) {
        this.$container = $container;
        const wrapper = document.createElement("DIV");
        wrapper.innerHTML = `
      <label for="jump">Change location</label>
      <input id="jump" type="text" placeholder="Example: Taipei, Taiwan or -13.162, -72.544">
      <input type="submit" value="Go!">
    `;
        this.$container.append(wrapper);
    }
}
