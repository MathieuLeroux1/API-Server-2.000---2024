////// Author: Nicolas Chourot
////// 2024
//////////////////////////////

const periodicRefreshPeriod = 2;
const waitingGifTrigger = 2000;
const minKeywordLenth = 3;
const keywordsOnchangeDelay = 500;

let categories = [];
let selectedCategory = "";
let currentETag = "";
let currentPostsCount = -1;
let periodic_Refresh_paused = false;
let postsPanel;
let itemLayout;
let waiting = null;
let showKeywords = false;
let keywordsOnchangeTimger = null;

Init_UI();
async function Init_UI() {
    postsPanel = new PageManager('postsScrollPanel', 'postsPanel', 'postSample', renderPosts);
    $('#createPost').on("click", async function () {
        showCreatePostForm();
    });
    $('#abort').on("click", async function () {
        showPosts();
    });
    $('#aboutCmd').on("click", function () {
        showAbout();
    });
    $("#showSearch").on('click', function () {
        toogleShowKeywords();
        showPosts();
    });

    installKeywordsOnkeyupEvent();
    await showPosts();
    start_Periodic_Refresh();
}

/////////////////////////// Search keywords UI //////////////////////////////////////////////////////////

function installKeywordsOnkeyupEvent() {

    $("#searchKeys").on('keyup', function () {
        clearTimeout(keywordsOnchangeTimger);
        keywordsOnchangeTimger = setTimeout(() => {
            cleanSearchKeywords();
            showPosts(true);
        }, keywordsOnchangeDelay);
    });
    $("#searchKeys").on('search', function () {
        showPosts(true);
    });
}
function cleanSearchKeywords() {
    /* Keep only keywords of 3 characters or more */
    let keywords = $("#searchKeys").val().trim().split(' ');
    let cleanedKeywords = "";
    keywords.forEach(keyword => {
        if (keyword.length >= minKeywordLenth) cleanedKeywords += keyword + " ";
    });
    $("#searchKeys").val(cleanedKeywords.trim());
}
function showSearchIcon() {
    $("#hiddenIcon").hide();
    $("#showSearch").show();
    if (showKeywords) {
        $("#searchKeys").show();
    }
    else
        $("#searchKeys").hide();
}
function hideSearchIcon() {
    $("#hiddenIcon").show();
    $("#showSearch").hide();
    $("#searchKeys").hide();
}
function toogleShowKeywords() {
    showKeywords = !showKeywords;
    if (showKeywords) {
        $("#searchKeys").show();
        $("#searchKeys").focus();
    }
    else {
        $("#searchKeys").hide();
        showPosts(true);
    }
}

/////////////////////////// Views management ////////////////////////////////////////////////////////////

function intialView() {
    $("#createPost").show();
    $("#hiddenIcon").hide();
    $("#hiddenIcon2").hide();
    $('#menu').show();
    $('#commit').hide();
    $('#abort').hide();
    $('#form').hide();
    $('#form').empty();
    $('#aboutContainer').hide();
    $('#errorContainer').hide();
    showSearchIcon();
}
async function showPosts(reset = false) {
    intialView();
    let user = Posts_API.retriveLoggedUser();
    if (user) {
        initTimeout(1000, () => logoutUser(user.Id));
    } else{
        noTimeout();
    }
    
    $("#viewTitle").text("Fil de nouvelles");
    periodic_Refresh_paused = false;
    await postsPanel.show(reset);
}
function hidePosts() {
    postsPanel.hide();
    hideSearchIcon();
    $("#createPost").hide();
    $('#menu').hide();
    periodic_Refresh_paused = true;
}
function showForm() {
    hidePosts();
    $('#form').show();
    $('#commit').show();
    $('#abort').show();
}
function showError(message, details = "") {
    hidePosts();
    $('#form').hide();
    $('#form').empty();
    $("#hiddenIcon").show();
    $("#hiddenIcon2").show();
    $('#commit').hide();
    $('#abort').show();
    $("#viewTitle").text("Erreur du serveur...");
    $("#errorContainer").show();
    $("#errorContainer").empty();
    $("#errorContainer").append($(`<div>${message}</div>`));
    $("#errorContainer").append($(`<div>${details}</div>`));
}

function showCreatePostForm() {
    showForm();
    $("#viewTitle").text("Ajout de nouvelle");
    renderPostForm();
}
function showEditPostForm(id) {
    showForm();
    $("#viewTitle").text("Modification");
    renderEditPostForm(id);
}
function showDeletePostForm(id) {
    showForm();
    $("#manageUsersContainer").hide();
    $("#viewTitle").text("Retrait");
    renderDeletePostForm(id);
}

async function logoutUser(user){
    await Posts_API.logout(user.Id);
    renderLoginForm();
}

async function likePost(postId) {
    try {
        let loggedUser = Posts_API.retriveLoggedUser();
        let loggedUserId = loggedUser.Id;
        let response = await Posts_API.GetLikes(postId, loggedUserId);
        let likes = (response) || [];
        let userAlreadyLiked = likes.some(like => like.UserId === loggedUserId);

        if (userAlreadyLiked) {
            let like = await Posts_API.GetLikes(postId, loggedUserId)
            await Posts_API.removeLikePost(like[0].Id);
        } else {
            let newLike = { PostId: postId, UserId: loggedUserId };
            await Posts_API.likePost(newLike);
        }
        await showPosts();
        postsPanel.scrollToElem(postId);
    } catch (error) {
        console.error("Erreur lors du basculement du like :", error);
        alert("Une erreur s'est produite lors du traitement de votre like. Veuillez réessayer.");
    }
}

function showAbout() {
    hidePosts();
    $("#hiddenIcon").show();
    $("#hiddenIcon2").show();
    $('#abort').show();
    $("#viewTitle").text("À propos...");
    $("#aboutContainer").show();
}

//////////////////////////// Posts rendering /////////////////////////////////////////////////////////////

function start_Periodic_Refresh() {
    $("#reloadPosts").addClass('white');
    $("#reloadPosts").on('click', async function () {
        $("#reloadPosts").addClass('white');
        postsPanel.resetScrollPosition();
        await showPosts();
    })
    setInterval(async () => {
        if (!periodic_Refresh_paused) {
            let etag = await Posts_API.HEAD();
            // the etag contain the number of model records in the following form
            // xxx-etag
            let postsCount = parseInt(etag.split("-")[0]);
            if (currentETag != etag) {           
                if (postsCount != currentPostsCount) {
                    console.log("postsCount", postsCount)
                    currentPostsCount = postsCount;
                    $("#reloadPosts").removeClass('white');
                } else
                    await showPosts();
                currentETag = etag;
            }
        }
    },
        periodicRefreshPeriod * 1000);
}
async function renderPosts(queryString) {
    timeout(20);
    let endOfData = false;
    queryString += "&sort=date,desc";
    compileCategories();
    if (selectedCategory != "") queryString += "&category=" + selectedCategory;
    if (showKeywords) {
        let keys = $("#searchKeys").val().replace(/[ ]/g, ',');
        if (keys !== "")
            queryString += "&keywords=" + $("#searchKeys").val().replace(/[ ]/g, ',')
    }
    let loggedUser = Posts_API.retriveLoggedUser();
    if(!loggedUser){
        noTimeout();
    }
    if(!((loggedUser != null && loggedUser != undefined) && (loggedUser.isSuper || loggedUser.isAdmin))){
        $("#createPost").hide();
        $("#hiddenIcon2").show();
    }
    addWaitingGif();
    let response = await Posts_API.GetQuery(queryString);
    if (!Posts_API.error) {
        currentETag = response.ETag;
        currentPostsCount = parseInt(currentETag.split("-")[0]);
        let Posts = response.data;
        if (Posts.length > 0) {
            await (async () => {
                for (const Post of Posts) {
                    let likes = null;
                    let userNamesTooltip = "";
                    let writer = null;
                    try{
                        likes = await Posts_API.GetLikes(Post.Id);
                        
                        await (async () => {
                            for (const like of likes) {
                                let user = await Posts_API.GetUser(like.UserId);
                                userNamesTooltip += user.Name;
                                userNamesTooltip += ", " + '\r';
                            }
                        })();

                        writer = await Posts_API.GetUser(Post.WriterId);
                    } catch { }
                    finally{
                        postsPanel.append(renderPost(Post, likes,userNamesTooltip,writer ));
                    }
                }
            })();
        } else
            endOfData = true;
        linefeeds_to_Html_br(".postText");
        highlightKeywords();
        attach_Posts_UI_Events_Callback();
    } else {
        showError(Posts_API.currentHttpError);
    }
    removeWaitingGif();
    return endOfData;
}
function renderPost(post, likes, userNamesTooltip, writer) {
    let date = convertToFrenchDate(UTC_To_Local(post.Date));
    var likeCount = 0;

    for(var prop in likes) {
        if(likes.hasOwnProperty(prop))
            ++likeCount;
    }

    let formattedLikeCount = new Intl.NumberFormat('fr-FR').format(likeCount);

    let loggedUser = Posts_API.retriveLoggedUser();
    let likeIconClass = "";
    if(loggedUser != null){
        let loggedUserId = loggedUser.Id;
        let userHasLiked = likes.some(like => like.UserId === loggedUserId);
        likeIconClass = userHasLiked ? 'liked' : 'notLiked';
    }
    
    if (!userNamesTooltip) {
        userNamesTooltip = "Aucun like pour l'instant";
    }
    let crudIcon = "";
    if((loggedUser != null && loggedUser != undefined) && (loggedUser.isSuper || loggedUser.isAdmin)){
        crudIcon += `
        <span class="editCmd cmdIconSmall fa fa-pencil" postId="${post.Id}" title="Modifier la nouvelle"></span>
        <span class="deleteCmd cmdIconSmall fa fa-trash" postId="${post.Id}" title="Effacer la nouvelle"></span>
        `;
    }
    if(loggedUser != null && loggedUser != undefined){
        crudIcon += `
        <span class="likeCmd cmdIconSmall fa fa-thumbs-up ${likeIconClass}" postId="${post.Id}" title="Liker la nouvelle"></span>
        <span class="likeCount" title="${userNamesTooltip}">${formattedLikeCount}</span>
        `;
    }
    
    return $(`
        <div class="post" id="${post.Id}">
            <div class="postHeader">
                ${post.Category}
                ${crudIcon}
            </div>
            <div class="postTitle"> ${post.Title} </div>
            <img class="postImage" src='${post.Image}'/>
            <div class="postDate"> ${date} </div>
            <div class="postWriterContainer">
                <img class="menuPhoto" src='${writer.Avatar}'/>
                <div class="writerName">${writer.Name}</div>
            </div>
            <div postId="${post.Id}" class="postTextContainer hideExtra">
                <div class="postText" >${post.Text}</div>
            </div>
            <div class="postfooter">
                <span postId="${post.Id}" class="moreText cmdIconXSmall fa fa-angle-double-down" title="Afficher la suite"></span>
                <span postId="${post.Id}" class="lessText cmdIconXSmall fa fa-angle-double-up" title="Réduire..."></span>
            </div>         
        </div>
    `);
}

async function compileCategories() {
    categories = [];
    let response = await Posts_API.GetQuery("?fields=category&sort=category");
    if (!Posts_API.error) {
        let items = response.data;
        if (items != null) {
            items.forEach(item => {
                if (!categories.includes(item.Category))
                    categories.push(item.Category);
            })
            if (!categories.includes(selectedCategory))
                selectedCategory = "";
            updateDropDownMenu(categories);
        }
    }
}
function updateDropDownMenu() {
    let DDMenu = $("#DDMenu");
    let selectClass = selectedCategory === "" ? "fa-check" : "fa-fw";
    DDMenu.empty();
    let user = null;
    try{
        user = Posts_API.retriveLoggedUser();
    }catch{ }
    if(user !== null || user === undefined){
        DDMenu.append($(`
            <div class="dropdown-item menuItemLayout" id="userInfo">
                <img class="menuPhoto" src="${user.Avatar}"></img>
                <span class="menuName">${user.Name}</span>
            </div>
        `));
        DDMenu.append($(`<div class="dropdown-divider"></div>`));
        if(user.isAdmin){
            DDMenu.append($(`
                <div class="dropdown-item menuItemLayout" id="manageUserCmd">
                    <i class="menuIcon fa fa-user-gear mx-2"></i>Gestion des usagers
                </div>
            `));
            DDMenu.append($(`<div class="dropdown-divider"></div>`));
        }
        DDMenu.append($(`
            <div class="dropdown-item menuItemLayout" id="editProfilCmd">
                <i class="menuIcon fa fa-user-pen mx-2"></i>Modifier votre profil
            </div>
            <div class="dropdown-item menuItemLayout" id="logoutCmd">
                <i class="menuIcon fa-solid fa-arrow-right-from-bracket mx-2"></i>Déconnexion
            </div>
        `));
    } else{
        DDMenu.append($(`
            <div class="dropdown-item menuItemLayout" id="loginCmd">
                <i class="menuIcon fa fa-arrow-right-to-bracket mx-2"></i>Connexion
            </div>
        `));
    }
    DDMenu.append($(`<div class="dropdown-divider"></div>`));
    DDMenu.append($(`
        <div class="dropdown-item menuItemLayout" id="allCatCmd">
            <i class="menuIcon fa ${selectClass} mx-2"></i> Toutes les catégories
        </div>
        `));
    DDMenu.append($(`<div class="dropdown-divider"></div>`));
    categories.forEach(category => {
        selectClass = selectedCategory === category ? "fa-check" : "fa-fw";
        DDMenu.append($(`
            <div class="dropdown-item menuItemLayout category" id="allCatCmd">
                <i class="menuIcon fa ${selectClass} mx-2"></i> ${category}
            </div>
        `));
    })
    DDMenu.append($(`<div class="dropdown-divider"></div> `));
    DDMenu.append($(`
        <div class="dropdown-item menuItemLayout" id="aboutCmd">
            <i class="menuIcon fa fa-info-circle mx-2"></i> À propos...
        </div>
        `));
    $('#aboutCmd').on("click", function () {
        showAbout();
    });
    $('#manageUserCmd').on("click", function () {
        renderManageUsers();
    });
    $('#logoutCmd').on("click", async function () {
        await Posts_API.logout(user.Id);
        renderLoginForm();
    });
    $('#loginCmd').on("click", async function () {
        renderLoginForm();
    });
    $('#editProfilCmd').on("click", async function () {
        showEditUserForm(user);
    });
    $('#allCatCmd').on("click", async function () {
        selectedCategory = "";
        await showPosts(true);
        updateDropDownMenu();
    });
    $('.category').on("click", async function () {
        selectedCategory = $(this).text().trim();
        await showPosts(true);
        updateDropDownMenu();
    });
}
function attach_Posts_UI_Events_Callback() {
    linefeeds_to_Html_br(".postText");
    // attach icon command click event callback
    $(".editCmd").off();
    $(".editCmd").on("click", function () {
        showEditPostForm($(this).attr("postId"));
    });
    $(".deleteCmd").off();
    $(".deleteCmd").on("click", function () {
        showDeletePostForm($(this).attr("postId"));
    });
    $(".likeCmd").off();
    $(".likeCmd").on("click", function () {
        likePost($(this).attr("postId"));
    });
    $(".moreText").off();
    $(".moreText").click(function () {
        $(`.commentsPanel[postId=${$(this).attr("postId")}]`).show();
        $(`.lessText[postId=${$(this).attr("postId")}]`).show();
        $(this).hide();
        $(`.postTextContainer[postId=${$(this).attr("postId")}]`).addClass('showExtra');
        $(`.postTextContainer[postId=${$(this).attr("postId")}]`).removeClass('hideExtra');
    })
    $(".lessText").off();
    $(".lessText").click(function () {
        $(`.commentsPanel[postId=${$(this).attr("postId")}]`).hide();
        $(`.moreText[postId=${$(this).attr("postId")}]`).show();
        $(this).hide();
        postsPanel.scrollToElem($(this).attr("postId"));
        $(`.postTextContainer[postId=${$(this).attr("postId")}]`).addClass('hideExtra');
        $(`.postTextContainer[postId=${$(this).attr("postId")}]`).removeClass('showExtra');
    })
}
function addWaitingGif() {
    clearTimeout(waiting);
    waiting = setTimeout(() => {
        postsPanel.itemsPanel.append($("<div id='waitingGif' class='waitingGifcontainer'><img class='waitingGif' src='Loading_icon.gif' /></div>'"));
    }, waitingGifTrigger)
}
function removeWaitingGif() {
    clearTimeout(waiting);
    $("#waitingGif").remove();
}

/////////////////////// Posts content manipulation ///////////////////////////////////////////////////////

function linefeeds_to_Html_br(selector) {
    $.each($(selector), function () {
        let postText = $(this);
        var str = postText.html();
        var regex = /[\r\n]/g;
        postText.html(str.replace(regex, "<br>"));
    })
}
function highlight(text, elem) {
    text = text.trim();
    if (text.length >= minKeywordLenth) {
        var innerHTML = elem.innerHTML;
        let startIndex = 0;

        while (startIndex < innerHTML.length) {
            var normalizedHtml = innerHTML.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            var index = normalizedHtml.indexOf(text, startIndex);
            let highLightedText = "";
            if (index >= startIndex) {
                highLightedText = "<span class='highlight'>" + innerHTML.substring(index, index + text.length) + "</span>";
                innerHTML = innerHTML.substring(0, index) + highLightedText + innerHTML.substring(index + text.length);
                startIndex = index + highLightedText.length + 1;
            } else
                startIndex = innerHTML.length + 1;
        }
        elem.innerHTML = innerHTML;
    }
}
function highlightKeywords() {
    if (showKeywords) {
        let keywords = $("#searchKeys").val().split(' ');
        if (keywords.length > 0) {
            keywords.forEach(key => {
                let titles = document.getElementsByClassName('postTitle');
                Array.from(titles).forEach(title => {
                    highlight(key, title);
                })
                let texts = document.getElementsByClassName('postText');
                Array.from(texts).forEach(text => {
                    highlight(key, text);
                })
            })
        }
    }
}

//////////////////////// Forms rendering /////////////////////////////////////////////////////////////////

async function renderEditPostForm(id) {
    $('#commit').show();
    addWaitingGif();
    let response = await Posts_API.Get(id)
    if (!Posts_API.error) {
        let Post = response.data;
        if (Post !== null)
            renderPostForm(Post);
        else
            showError("Post introuvable!");
    } else {
        showError(Posts_API.currentHttpError);
    }
    removeWaitingGif();
}
async function renderDeletePostForm(id) {
    let response = await Posts_API.Get(id)
    if (!Posts_API.error) {
        let post = response.data;
        if (post !== null) {
            let date = convertToFrenchDate(UTC_To_Local(post.Date));
            $("#form").append(`
                <div class="post" id="${post.Id}">
                <div class="postHeader">  ${post.Category} </div>
                <div class="postTitle ellipsis"> ${post.Title} </div>
                <img class="postImage" src='${post.Image}'/>
                <div class="postDate"> ${date} </div>
                <div class="postTextContainer showExtra">
                    <div class="postText">${post.Text}</div>
                </div>
            `);
            linefeeds_to_Html_br(".postText");
            // attach form buttons click event callback
            $('#commit').on("click", async function () {
                await Posts_API.Delete(post.Id);
                if (!Posts_API.error) {
                    await showPosts();
                }
                else {
                    console.log(Posts_API.currentHttpError)
                    showError("Une erreur est survenue!");
                }
            });
            $('#cancel').on("click", async function () {
                await showPosts();
            });

        } else {
            showError("Post introuvable!");
        }
    } else
        showError(Posts_API.currentHttpError);
}
function newPost() {
    let Post = {};
    Post.Id = 0;
    Post.Title = "";
    Post.Text = "";
    Post.Image = "news-logo-upload.png";
    Post.Category = "";
    return Post;
}
function renderPostForm(post = null) {
    let create = post == null;
    if (create) post = newPost();
    $("#form").show();
    $("#form").empty();
    $("#form").append(`
        <form class="form" id="postForm">
            <input type="hidden" name="Id" value="${post.Id}"/>
            <input type="hidden" name="Date" value="${post.Date}"/>
            <input type="hidden" name="WriterId" value="${post.WriterId}"/>
            <label for="Category" class="form-label">Catégorie </label>
            <input 
                class="form-control"
                name="Category"
                id="Category"
                placeholder="Catégorie"
                required
                value="${post.Category}"
            />
            <label for="Title" class="form-label">Titre </label>
            <input 
                class="form-control"
                name="Title" 
                id="Title" 
                placeholder="Titre"
                required
                RequireMessage="Veuillez entrer un titre"
                InvalidMessage="Le titre comporte un caractère illégal"
                value="${post.Title}"
            />
            <label for="Url" class="form-label">Texte</label>
             <textarea class="form-control" 
                          name="Text" 
                          id="Text"
                          placeholder="Texte" 
                          rows="9"
                          required 
                          RequireMessage = 'Veuillez entrer une Description'>${post.Text}</textarea>

            <label class="form-label">Image </label>
            <div class='imageUploaderContainer'>
                <div class='imageUploader' 
                     newImage='${create}' 
                     controlId='Image' 
                     imageSrc='${post.Image}' 
                     waitingImage="Loading_icon.gif">
                </div>
            </div>
            <div id="keepDateControl">
                <input type="checkbox" name="keepDate" id="keepDate" class="checkbox" checked>
                <label for="keepDate"> Conserver la date de création </label>
            </div>
            <input type="submit" value="Enregistrer" id="savePost" class="btn btn-primary displayNone">
        </form>
    `);
    if (create) $("#keepDateControl").hide();

    initImageUploaders();
    initFormValidation(); // important do to after all html injection!

    $("#commit").click(function () {
        $("#commit").off();
        return $('#savePost').trigger("click");
    });
    $('#postForm').on("submit", async function (event) {
        event.preventDefault();
        let post = getFormData($("#postForm"));
        let loggedUser = Posts_API.retriveLoggedUser();
        if (post.Category != selectedCategory)
            selectedCategory = "";
        if (create || !('keepDate' in post))
            post.Date = Local_to_UTC(Date.now());
        if(create)
            post.WriterId = loggedUser.Id;
        delete post.keepDate;
        post = await Posts_API.Save(post, create);
        if (!Posts_API.error) {
            await showPosts();
            postsPanel.scrollToElem(post.Id);
        }
        else
            showError("Une erreur est survenue! ", Posts_API.currentHttpError);
    });
    $('#cancel').on("click", async function () {
        await showPosts();
    });
}
function getFormData($form) {
    // prevent html injections
    const removeTag = new RegExp("(<[a-zA-Z0-9]+>)|(</[a-zA-Z0-9]+>)", "g");
    var jsonObject = {};
    // grab data from all controls
    $.each($form.serializeArray(), (index, control) => {
        jsonObject[control.name] = control.value.replace(removeTag, "");
    });
    return jsonObject;
}

//////////////////////// Login rendering /////////////////////////////////////////////////////////////////

function showCreateUserForm() {
    showForm();
    $("#viewTitle").text("Inscription");
    renderProfilForm();
}
function showEditUserForm(user) {
    showForm();
    $("#viewTitle").text("Modification");
    renderEditProfilForm(user);
}
function showDeleteUserForm() {
    showForm();
    $("#viewTitle").text("Suppression");
    renderDeletePostForm();
}

function renderEditProfilForm(user) {
    addWaitingGif();
    if (user !== null || user !== undefined) {
        renderProfilForm(user);
    } else {
        showError("Utilisateur introuvable!");
    }
    removeWaitingGif();
}

function newUser(){
    let User = {};
    User.Id = 0;
    User.Email = "";
    User.Password = "";
    User.Name = "";
    User.Avatar = "./no-avatar.png";
    return User;
}

function renderProfilForm(user = null){
    noTimeout();
    let create = user == null;
    if (create) user = newUser();
    $('#commit').hide();
    $("#hiddenIcon").show();
    $("#hiddenIcon2").show();
    $('#abort').show();
    $("#form").show();
    $("#form").empty();
    $("#manageUsersContainer").hide();
    $("#form").append(`
        <div id="statusMessage"></div>
        <form class="loginForm" id="createProfilForm">
            <input type="hidden" name="Id" value="${user.Id}"/>
            <fieldset>
                <div class="fieldsetLabel">Adresse de courriel</div>
                <input  type="email" 
                        name="Email"
                        id="Email"
                        class="form-control"
                        required
                        placeholder="Courriel"
                        value="${user.Email}">
                <input  type="email"
                        name="matchedEmail"
                        id="matchedEmail"
                        class="form-control"
                        required
                        placeholder="Vérification">
                <span class="loginError" id="EmailError" hidden>Erreur courriel</span>
            </fieldset>
            
            <fieldset>
                <div class="fieldsetLabel">Mot de passe</div>
                <input  type="password" 
                        name="Password"
                        id="Password"
                        class="form-control"
                        required
                        placeholder="Mot de passe"
                        >

                <input  type="password" 
                        name="matchedPassword"
                        id="matchedPassword"
                        class="form-control"
                        required
                        placeholder="Vérification"
                        >
                <span class="loginError" id="PasswordError" hidden>Erreur mdp</span>
            </fieldset>

            <fieldset>
                <div class="fieldsetLabel">Nom</div>
                <input  type="text" 
                        name="Name"
                        class="form-control"
                        required
                        placeholder="Nom"
                        value="${user.Name}">
                <span class="loginError" id="NameError" hidden>Erreur mdp</span>
            </fieldset>

            <fieldset>
                <div class="fieldsetLabel">Avatar</div>
                <div class='imageUploaderContainer'>
                    <div class='imageUploader' 
                        newImage='' 
                        controlId='Avatar' 
                        imageSrc='${user.Avatar}' 
                        waitingImage="Loading_icon.gif">
                    </div>
                </div>
            </fieldset>
            <div class="CreateBtnsContainer">
                <input type="submit" value="Enregistrer" class="btn btn-primary" id="SaveUser">
                <button type="button" id="abortCreateProfilCmd" class="btn btn-secondary">Annuler</button>
                <button type="button" id="deleteProfilCmd" class="btn btn-warning">Effacer le compte</button>
            </div>
        </form>
    `);
    
    initImageUploaders();
    initFormValidation();

    if (create) {
        $("#abort").on('click', renderLoginForm);
        $("#abortCreateProfilCmd").show().on('click', renderLoginForm);
        $("#deleteProfilCmd").hide();
        addConflictValidation(Posts_API.checkConflictURL(), 'Email', 'SaveUser');
    } else {
        $("#abort").on('click', async function () {
            await showPosts();
        });
        $("#abortCreateProfilCmd").hide();
        $("#deleteProfilCmd").show().on('click', showDeleteUserForm);
        let currentLoggedUser = Posts_API.retriveLoggedUser();
        if(!(currentLoggedUser.Email ===  $("#Email").val())){
            addConflictValidation(Posts_API.checkConflictURL(), 'Email', 'SaveUser');
        }
    }
    
   
    $('#createProfilForm').on("submit", async function (event){
        let profil = getFormData($('#createProfilForm'));
        if (profil.Password !== profil.matchedPassword) {
            $("#PasswordError").text("Les mots de passe ne correspondent pas.").css("color", "red");
            return;
        }
        delete profil.matchedPassword;
        delete profil.matchedEmail;
        event.preventDefault();
        let result = null;

        if(create){
            delete profil.Id;
            result = await Posts_API.register(profil);
        } else{
            result = await Posts_API.modifiy(profil);
        }
        console.log(result);
        if (result) {
            if(create){
                $("#statusMessage").text("Compte créé avec succès !").css("color", "green");
                renderLoginForm();
            } else {
                updateDropDownMenu();
                await showPosts();
            }
            
        } else {
            $("#statusMessage").text("Erreur lors de la création du compte.").css("color", "red");
        }
    });
}

function renderDeletePostForm(){
    $('#commit').hide();
    $("#hiddenIcon").show();
    $("#hiddenIcon2").show();
    $('#abort').show();
    $("#form").empty();
    $("#form").append(`
        <div class="deleteConfirmation">
            <h3 class="confirmationText">Voulez-vous vraiment effacer votre compte?</h3>
            <p>Note : Vos nouvelles et vos likes vont être effacés.</p>
            <div class="confirmationBtns">
                <button type="button" id="confirmDeleteUser" class="btn btn-danger">Effacer mon compte</button>
                <button type="button" id="cancelDeleteUser" class="btn btn-secondary">Annuler</button>
            </div>
        </div>
    `);

    $("#confirmDeleteUser").on('click', async function () {
        let currentLoggedUser = Posts_API.retriveLoggedUser();
        if (currentLoggedUser) {
            await Posts_API.Remove(currentLoggedUser.Id);
            Posts_API.ereaseAccessToken();
            Posts_API.ereaseLoggedUser();
            renderLoginForm();
        }
    });

    $("#cancelDeleteUser").on('click', function () {
        let currentLoggedUser = Posts_API.retriveLoggedUser();
        showEditUserForm(currentLoggedUser);
    });
    $("#abort").on('click', function () {
        let currentLoggedUser = Posts_API.retriveLoggedUser();
        showEditUserForm(currentLoggedUser);
    });
}

function renderLoginForm() {
    noTimeout();
    hidePosts();
    $("#hiddenIcon").show();
    $("#hiddenIcon2").show();
    $('#abort').show();
    $("#viewTitle").text("Connexion");
    $("#form").show();
    $("#form").empty();
    $("#manageUsersContainer").hide();
    $("#form").append(`
        <div class="content loginForm" id="loginForm">
            <div id="statusMessage"></div>
            <form id="loginFormContent">
                <input  type="email" 
                        name="Email"
                        class="form-control"
                        required
                        placeholder="adresse de courriel">
                <span class="loginError" id="EmailError"></span>

                <input  type="password" 
                        name="Password"
                        class="form-control"
                        required
                        placeholder="Mot de passe">
                <span class="loginError" id="PasswordError"></span>

                <input type="submit" name="submit" value="Entrer" style="margin-top:1rem" class="form-control btn-primary">
            </form>
            <div id="newAccountContainer">
                <hr>
                <button class="form-control btn-info" id="newAccountBtn">Nouveau compte</button>
            </div>
        </div>
    `);

    $("#newAccountBtn").on("click", function (event) {
        event.preventDefault();
        $("#newAccountContainer").hide();
        showCreateUserForm();
    });

    $("#abort").on("click", async function (event) {
        await showPosts();
    });

    $("#loginFormContent").on("submit", async function (event) {
        event.preventDefault();

        $("#EmailError").empty();
        $("#PasswordError").empty();
        $("#statusMessage").empty();
        let loginInfos = getFormData($("#loginFormContent"));
        let user = await Posts_API.GetUserByEmail(loginInfos.Email);
        let result = null;
        let isBlocked = false;
        if(!(user[0].Authorizations.readAccess === -1 && user[0].Authorizations.writeAccess === -1)){
            result = await Posts_API.login(loginInfos.Email, loginInfos.Password);
        }else{
            isBlocked = true;
        }
        if (result) {
            $("#statusMessage").text("Connexion réussie !").css("color", "green");
            if(result.User.VerifyCode !== "verified"){
                renderVerificationForm(result.User.Id);
            }else{
                await showPosts();
            }
        } else {
            const errorCode = Posts_API.currentStatus;
            if (errorCode === 481) {
                $("#EmailError").text("Adresse courriel incorrecte.");
            } else if (errorCode === 482) {
                $("#PasswordError").text("Mot de passe incorrect.");
            } else if (isBlocked) {
                $("#EmailError").text("Votre compte est bloqué.");
            } else {
                $("#statusMessage").text("Erreur de connexion. Veuillez réessayer.");
            }
        }
    });
}

function renderVerificationForm(userId){
    noTimeout();
    $("#form").empty();
    $("#form").append(`
        <div class="content loginForm" id="verifyForm">
            <div id="statusMessage"></div>
            <form id="verifyFormContent">
                <div>Veuillez entrer le code de vérification que vous avez reçu par courriel</div>
                <input type="hidden" name="Id" value="${userId}"/>
                <input  type="text" 
                        name="Code"
                        class="form-control"
                        required
                        minlength="6" maxlength="6"
                        placeholder="Code de vérification de courriel">
                <span class="loginError" id="EmailError" hidden>Erreur courriel</span>

                <input type="submit" name="submit" value="Vérifier" style="margin-top:1rem" class="form-control btn-primary">
            </form>
        </div>
    `);
    
    $('#abort').on("click", async function () {
        renderLoginForm();
    });

    $("#verifyFormContent").on("submit", async function (event) {
        event.preventDefault();

        let data = getFormData($('#verifyFormContent'));
        const result = await Posts_API.verify(data.Id, data.Code);
        if (result) {
            await showPosts();
        } else {
            $("#statusMessage").text("Erreur de vérification.").css("color", "red");
        }
    });
}

//////////////////////// Admin rendering /////////////////////////////////////////////////////////////////

async function renderManageUsers(){
    timeout(100);
    let loggedUser = Posts_API.retriveLoggedUser();
    if(loggedUser.isAdmin){
        let users = await Posts_API.GetUser();
        users = users.filter(user => user.Id !== loggedUser.Id);

        hidePosts();
        $("#manageUsersContainer").show();
        $("#hiddenIcon").show();
        $("#hiddenIcon2").show();
        $('#abort').show();
        $("#viewTitle").text("Gestion des usagers");
        $("#manageUsersContainer").empty();

        $("#manageUsersContainer").append(`
            <table class="admin-users-table">
                <thead>
                    <tr>
                        <th>Avatar</th>
                        <th>Nom</th>
                        <th>Rôle</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="userRows"></tbody>
            </table>
        `);
        
        users.forEach(user => {
            let role = "Usager de base";
            if (user.isAdmin) role = "Administrateur";
            else if (user.isSuper) role = "Super usager";
        
            const nextRole = user.isAdmin ? "Usager de base" : user.isSuper ? "Administrateur" : "Super usager";
        
            $("#userRows").append(`
                <tr>
                    <td>
                        <img src="${user.Avatar || 'default-avatar.png'}" alt="Avatar" class="user-avatar" />
                    </td>
                    <td class="user-name">${user.Name}</td>
                    <td class="user-role">${role}</td>
                    <td>
                        <div class="action-icons">
                            <i class="fas fa-user-plus icon-promote" 
                                userId="${user.Id}" 
                                title="Promouvoir à ${nextRole}"></i>
                            <i class="fas ${user.isBlocked ? 'fa-lock' : 'fa-lock-open'} icon-block" 
                                userId="${user.Id}" 
                                title="${user.isBlocked ? 'Débloquer' : 'Bloquer'}"></i>
                            <i class="fas fa-trash icon-delete" 
                                userId="${user.Id}" 
                                title="Effacer"></i>
                        </div>
                    </td>
                </tr>
            `);
        });
        
        $('#abort').on("click", async function () {
            $("#manageUsersContainer").hide();
        });

        $(".icon-promote").on("click", async function () {
            const userId = $(this).attr("userId");
            const user = await Posts_API.GetUser(userId);
            console.log(user);
            const response = await Posts_API.Promote(user);

            if (response) {
                renderManageUsers();
            } else {
                alert("Erreur lors de la promotion.");
            }
        });

        $(".icon-block").on("click", async function () {
            const userId = $(this).attr("userId");
            const user = await Posts_API.GetUser(userId);
            const response = await Posts_API.Block(user);

            if (response) {
                renderManageUsers();
            } else {
                alert("Erreur lors du blocage/déblocage.");
            }
        });

        $(".icon-delete").on("click", async function () {
            const userId = $(this).attr("userId");
            const confirmation = confirm("Êtes-vous sûr de vouloir supprimer cet utilisateur ?");
            if (!confirmation) return;

            await Posts_API.Remove(userId);
            renderManageUsers();
        });
    }
}


