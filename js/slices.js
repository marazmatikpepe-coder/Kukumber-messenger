<!-- МОДАЛЬНОЕ ОКНО СОЗДАНИЯ ПОСТА SLICES -->
<div id="create-slice-modal" class="modal hidden">
    <div class="modal-content" style="max-width: 600px;">
        <div class="modal-header">
            <h3>🍕 Новый слайс</h3>
            <button onclick="closeCreateSliceModal()" class="btn-close">×</button>
        </div>
        
        <div id="slice-upload-area" class="slice-upload-area" onclick="addSliceMedia()">
            <span>📷</span>
            <p>Нажмите чтобы добавить фото или GIF</p>
            <small>Можно несколько файлов</small>
        </div>
        
        <div id="slice-preview-container" class="slice-preview-container hidden">
            <div class="slice-preview-header">
                <span>📸 Медиафайлы (<span id="slice-preview-counter">0</span>)</span>
                <button onclick="addSliceMedia()" class="slice-add-more">+ Добавить ещё</button>
            </div>
            <div id="slice-preview-area" class="slice-preview-area"></div>
        </div>
        
        <textarea id="slice-text" class="slice-text-input" placeholder="Что у вас нового? #хештеги @упоминания" maxlength="5000"></textarea>
        
        <input type="text" id="slice-hashtags-input" class="slice-hashtags-input" placeholder="#хештеги через пробел">
        
        <div class="modal-buttons" style="padding: 15px;">
            <button onclick="closeCreateSliceModal()" class="btn-secondary">Отмена</button>
            <button onclick="publishSlice()" class="btn-primary">🍕 Опубликовать</button>
        </div>
    </div>
</div>
