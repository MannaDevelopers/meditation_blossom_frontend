package app.mannadev.meditation.data // 실제 패키지명으로 변경

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.io.FileOutputStream

@RunWith(AndroidJUnit4::class)
class SermonLocalDataSourceTest {

    companion object {
        // 테스트용 DB 파일 이름 (assets 폴더 내의 파일과 동일하게)
        private const val TEST_DB_NAME = "RKStorage_test.db" // 실제 DB와 구분되는 이름 권장
        private const val ORIGINAL_DB_NAME = "RKStorage" // SermonLocalDataSource가 사용하는 DB 이름
    }

    private var asyncStorage: AsyncStorage? = null
    private var testDbFile: File? = null


    @Before
    fun setUp() {
        copyDatabaseFromAssets()
    }

    private fun copyDatabaseFromAssets() {
        println("### copyDatabaseFromAssets ###")
        val assetContext = InstrumentationRegistry.getInstrumentation().context

        val context = ApplicationProvider.getApplicationContext<Context>()
        context.openOrCreateDatabase(ORIGINAL_DB_NAME, Context.MODE_PRIVATE, null).close()

        try {
            val inputStream = assetContext.assets.open(TEST_DB_NAME) // assets 폴더의 DB 파일
            val dbPath = context.getDatabasePath(ORIGINAL_DB_NAME) // 실제 DB 경로
            val outputStream = FileOutputStream(dbPath)
            inputStream.copyTo(outputStream)
            inputStream.close()
            outputStream.flush()
            outputStream.close()
            testDbFile = dbPath // 복사된 DB 파일 객체 저장
        } catch (e: Exception) {
            e.printStackTrace()
            throw RuntimeException("Error copying database from assets", e)
        }
        asyncStorage = AsyncStorage(context)
    }

    @After
    fun tearDown() {
        // 테스트 후 생성된 테스트 DB 파일 삭제
        if (testDbFile?.exists() == true) {
            testDbFile?.delete()
        }
    }

    @Test
    fun getDisplaySermonJson_whenDataExists_returnsJsonString() = runTest {
        val asyncStorage = checkNotNull(this@SermonLocalDataSourceTest.asyncStorage)
        // given: 테스트 DB 파일에 "display_sermon" 키와 특정 JSON 문자열 값이 있다고 가정
        // (이 데이터는 assets/RKStorage_test.db 파일에 미리 준비되어 있어야 함)
        // 예를 들어, assets/RKStorage_test.db에는 다음 데이터가 삽입되어 있다고 가정:
        // INSERT INTO catalystLocalStorage (key, value) VALUES ('display_sermon', '[{"title":"Test Sermon"}]');


        // when
        val result = asyncStorage.get("display_sermon")

        // then
        println(result)
    }

}